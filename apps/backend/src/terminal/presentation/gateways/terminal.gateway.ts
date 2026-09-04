import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import type { AuthenticatedSocket } from '../../../common/types/authenticated-socket.type';
import {
  Injectable,
  Logger,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { PERMISSIONS } from '../../../common/constants/permissions';
import { IMPERSONATION_TOKEN_USE } from '../../../common/constants/impersonation';

// 애플리케이션 서비스 (실시간 인프라)
import {
  PtyManagerService,
  SessionMapperService,
} from '../../application/services';

// 권한 확인은 rbac 모듈의 책임
import { WsPermissionService } from '../../../rbac/application/services/ws-permission.service';

// 애플리케이션 유스케이스 (도메인/세션 오케스트레이션)
import {
  CheckTerminalCommandLimitUseCase,
  ClearTerminalHistoryUseCase,
  CloseTerminalSessionUseCase,
  CreateTerminalSessionUseCase,
  DeleteTerminalSessionUseCase,
  GetOrCreateTerminalSessionUseCase,
  GetTerminalHistoryUseCase,
  LoadTerminalSessionUseCase,
  SaveTerminalMessageUseCase,
  TouchTerminalSessionUseCase,
  UpdateTerminalActivityUseCase,
} from '../../application/use-cases';

/**
 * 터미널 게이트웨이
 * Presentation 계층 — 웹소켓 연결만 담당한다.
 * 비즈니스 로직은 애플리케이션 유스케이스에 위임하고,
 * 실시간 처리(PTY, 클라이언트-세션 매핑, emit)만 이곳에 둔다.
 */
@Injectable()
@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3000' },
  namespace: '/terminal',
})
export class TerminalGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TerminalGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly ptyManager: PtyManagerService,
    private readonly sessionMapper: SessionMapperService,
    private readonly wsPermission: WsPermissionService,
    private readonly getOrCreateTerminalSession: GetOrCreateTerminalSessionUseCase,
    private readonly getTerminalHistory: GetTerminalHistoryUseCase,
    private readonly saveTerminalMessage: SaveTerminalMessageUseCase,
    private readonly clearTerminalHistory: ClearTerminalHistoryUseCase,
    private readonly updateTerminalActivity: UpdateTerminalActivityUseCase,
    private readonly touchTerminalSession: TouchTerminalSessionUseCase,
    private readonly createTerminalSession: CreateTerminalSessionUseCase,
    private readonly loadTerminalSession: LoadTerminalSessionUseCase,
    private readonly closeTerminalSession: CloseTerminalSessionUseCase,
    private readonly deleteTerminalSession: DeleteTerminalSessionUseCase,
    private readonly checkTerminalCommandLimit: CheckTerminalCommandLimitUseCase,
  ) {}

  private async checkPermission(
    client: AuthenticatedSocket,
    requiredPermission: string,
  ): Promise<boolean> {
    const user = client.user;
    if (!user || !user.sub) return false;
    return this.wsPermission.checkPermission(user.sub, requiredPermission);
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = client.handshake.auth.token;
      if (!token) throw new UnauthorizedException('No token provided');

      const payload = this.jwtService.verify(token);
      client.user = payload;

      if (payload.tokenUse === IMPERSONATION_TOKEN_USE) {
        throw new ForbiddenException(
          'QA 사용자 미리보기에서는 터미널을 실행할 수 없습니다',
        );
      }

      const hasPermission = await this.checkPermission(
        client,
        PERMISSIONS.TERMINAL_ACCESS,
      );
      if (!hasPermission) {
        throw new ForbiddenException('터미널 접근 권한이 없습니다');
      }

      this.logger.log(
        `[Terminal] Client connected: ${client.id} (user: ${payload.email})`,
      );

      const { session, isReconnect } =
        await this.getOrCreateTerminalSession.execute(
          payload.sub,
          client.handshake.auth.sessionId,
        );

      this.sessionMapper.mapClientToSession(client.id, session.id);

      client.emit('terminal:session-ready', {
        sessionId: session.id,
        isReconnect,
        workingDirectory: this.ptyManager.getWorkingDirectory(),
        shellPath: this.ptyManager.getShellPath(),
        claudeBinaryPath: this.ptyManager.getClaudeBinaryPath(),
        claudeLaunchCommand: this.ptyManager.getClaudeLaunchCommand(),
      });

      if (isReconnect) {
        const messages = await this.getTerminalHistory.execute(
          session.id,
          payload.sub,
        );
        if (messages.length > 0) {
          this.logger.log(
            `[Terminal] Loading ${messages.length} messages for session: ${session.id}`,
          );
          client.emit('terminal:history', {
            messages: messages.map((m) => ({
              role: m.role,
              content: m.content,
              timestamp: m.timestamp,
            })),
          });
        }
      }

      let shell = this.ptyManager.getPty(session.id);
      if (isReconnect && shell) {
        this.logger.log(
          `[Terminal] Reusing existing PTY for session: ${session.id}`,
        );
      } else {
        try {
          shell = this.ptyManager.createPty(session.id);

          shell.onData(async (data) => {
            try {
              await this.saveTerminalMessage.execute(
                session.id,
                payload.sub,
                'system',
                data,
              );
            } catch (err) {
              this.logger.error('[Terminal] Failed to save output to DB:', err);
            }

            const clients = this.sessionMapper.getClients(session.id);
            if (clients) {
              clients.forEach((clientId) => {
                this.server.to(clientId).emit('terminal:output', {
                  type: 'stdout',
                  content: data,
                });
              });
            }
          });

          shell.onExit(({ exitCode, signal }) => {
            this.logger.error(
              `[Terminal] PTY process exited unexpectedly for session ${session.id}:`,
              { exitCode, signal },
            );
            const clients = this.sessionMapper.getClients(session.id);
            if (clients) {
              clients.forEach((clientId) => {
                this.server.to(clientId).emit('terminal:error', {
                  message: `터미널 프로세스가 종료되었습니다 (exitCode: ${exitCode}, signal: ${signal})`,
                });
                this.server
                  .to(clientId)
                  .emit('terminal:exit', { code: exitCode });
              });
            }
            this.ptyManager.deletePty(session.id);
            this.sessionMapper.clearSession(session.id);
          });

          this.logger.log(
            `[Terminal] PTY setup complete for session: ${session.id}`,
          );
        } catch (ptyError) {
          this.logger.error(
            `[Terminal] Failed to create PTY for session ${session.id}:`,
            ptyError,
          );
          throw new Error('PTY 프로세스 생성 실패: ' + ptyError.message, {
            cause: ptyError,
          });
        }
      }

      await this.touchTerminalSession.execute(session);
    } catch (error) {
      this.logger.error('[Terminal] Connection failed:', error.message);
      client.emit('terminal:error', { message: '연결 실패: ' + error.message });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`[Terminal] Client disconnected: ${client.id}`);
    this.sessionMapper.unmapClient(client.id);
  }

  @SubscribeMessage('terminal:input')
  async handleInput(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { message: string },
  ) {
    const sessionId = this.sessionMapper.getSessionId(client.id);
    if (!sessionId) {
      client.emit('terminal:error', { message: 'Session not found' });
      return;
    }

    const isCommand =
      data.message.includes('\r') || data.message.includes('\n');
    const userId = client.user?.sub;
    if (!userId) {
      client.emit('terminal:error', { message: 'Unauthorized' });
      return;
    }

    if (isCommand) {
      if (userId) {
        const result = await this.checkTerminalCommandLimit.execute(userId);

        if (!result.allowed) {
          client.emit('terminal:error', {
            message: `터미널 명령어 제한 (${result.limit}회)에 도달했습니다. 관리자에게 문의하세요.`,
          });
          client.emit('terminal:limit-reached', {
            limit: result.limit,
            count: result.count,
          });
          return;
        }

        client.emit('terminal:command-count', {
          count: result.count,
          limit: result.limit,
          remaining: result.remaining,
        });
      }

      const commandText = data.message.replace(/[\r\n]/g, '').trim();
      if (commandText === 'clear') {
        this.logger.log(
          `[Terminal] User typed 'clear', deleting history for session: ${sessionId}`,
        );
        await this.clearTerminalHistory.execute(sessionId, userId);
        await this.saveTerminalMessage.execute(
          sessionId,
          userId,
          'user',
          commandText,
        );
      } else if (commandText) {
        await this.saveTerminalMessage.execute(
          sessionId,
          userId,
          'user',
          commandText,
        );
      }
    }

    this.ptyManager.write(sessionId, data.message);
    await this.updateTerminalActivity.execute(sessionId, userId);
  }

  @SubscribeMessage('terminal:interrupt')
  handleInterrupt(@ConnectedSocket() client: Socket) {
    const sessionId = this.sessionMapper.getSessionId(client.id);
    if (sessionId) this.ptyManager.interrupt(sessionId);
  }

  @SubscribeMessage('terminal:resize')
  handleResize(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { cols: number; rows: number },
  ) {
    const sessionId = this.sessionMapper.getSessionId(client.id);
    if (sessionId) this.ptyManager.resize(sessionId, data.cols, data.rows);
  }

  @SubscribeMessage('terminal:create-session')
  async handleCreateSession(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { title: string },
  ) {
    if (!client.user?.sub) {
      client.emit('terminal:error', { message: 'Unauthorized' });
      return;
    }

    const session = await this.createTerminalSession.execute(
      client.user.sub,
      data.title,
    );
    client.emit('terminal:session-created', { sessionId: session.id });
    return session;
  }

  @SubscribeMessage('terminal:save-message')
  async handleSaveMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: {
      sessionId: string;
      role: 'user' | 'assistant';
      content: string;
    },
  ) {
    if (!client.user?.sub) {
      client.emit('terminal:error', { message: 'Unauthorized' });
      return;
    }

    await this.saveTerminalMessage.execute(
      data.sessionId,
      client.user.sub,
      data.role,
      data.content,
    );
    return { success: true };
  }

  @SubscribeMessage('terminal:load-session')
  async handleLoadSession(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { sessionId: string },
  ) {
    if (!client.user?.sub) {
      client.emit('terminal:error', { message: 'Unauthorized' });
      return;
    }

    const session = await this.loadTerminalSession.execute(
      data.sessionId,
      client.user.sub,
    );
    if (!session) {
      client.emit('terminal:error', { message: 'Session not found' });
      return;
    }

    const messages = session.messages.sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );

    client.emit('terminal:session-loaded', {
      session: {
        id: session.id,
        title: session.title,
        createdAt: session.createdAt,
      },
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      })),
    });

    return { success: true };
  }

  @SubscribeMessage('terminal:slash-command')
  handleSlashCommand(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { command: string; args?: string[] },
  ) {
    const sessionId = this.sessionMapper.getSessionId(client.id);
    if (!sessionId) {
      client.emit('terminal:error', { message: 'Session not found' });
      return;
    }

    const commandStr = `/${data.command}${data.args ? ' ' + data.args.join(' ') : ''}\n`;
    this.ptyManager.write(sessionId, commandStr);
    return { success: true };
  }

  @SubscribeMessage('terminal:clear-history')
  async handleClearHistory(@ConnectedSocket() client: AuthenticatedSocket) {
    const sessionId = this.sessionMapper.getSessionId(client.id);
    if (!sessionId) return;
    if (!client.user?.sub) {
      client.emit('terminal:error', { message: 'Unauthorized' });
      return;
    }

    this.logger.log(`[Terminal] Clearing history for session: ${sessionId}`);
    await this.clearTerminalHistory.execute(sessionId, client.user.sub);
    return { success: true };
  }

  @SubscribeMessage('terminal:close-session')
  async handleCloseSession(@ConnectedSocket() client: AuthenticatedSocket) {
    const sessionId = this.sessionMapper.getSessionId(client.id);
    if (!sessionId) return;
    if (!client.user?.sub) {
      client.emit('terminal:error', { message: 'Unauthorized' });
      return;
    }

    this.logger.log(`[Terminal] Explicitly closing session: ${sessionId}`);
    this.ptyManager.killPty(sessionId);
    await this.closeTerminalSession.execute(sessionId, client.user.sub);

    const clients = this.sessionMapper.getClients(sessionId);
    if (clients) {
      clients.forEach((clientId) => {
        this.server.to(clientId).emit('terminal:session-closed');
      });
    }

    this.sessionMapper.clearSession(sessionId);
    return { success: true };
  }

  @SubscribeMessage('terminal:delete-session')
  async handleDeleteSession(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { sessionId: string },
  ) {
    const user = client.user;
    if (!user || !user.sub) {
      client.emit('terminal:error', { message: 'Unauthorized' });
      return;
    }

    const session = await this.deleteTerminalSession.execute(
      data.sessionId,
      user.sub,
    );
    if (!session) {
      client.emit('terminal:error', { message: 'Session not found' });
      return;
    }

    this.logger.log(`[Terminal] Deleting session: ${data.sessionId}`);
    this.ptyManager.killPty(data.sessionId);
    this.sessionMapper.clearSession(data.sessionId);
    return { success: true };
  }
}
