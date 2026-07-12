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

// Application Services
import {
  PtyManagerService,
  SessionMapperService,
  TerminalLimitService,
  WsPermissionService,
} from '../../application/services';
import { TerminalSessionService } from '../../application/services/terminal-session.service';

/**
 * Terminal Gateway
 * Presentation layer - handles WebSocket connections only
 * Delegates business logic to application services
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
    private readonly terminalLimit: TerminalLimitService,
    private readonly terminalSession: TerminalSessionService,
    private readonly wsPermission: WsPermissionService,
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
        await this.terminalSession.getOrCreateSession(
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
        const messages = await this.terminalSession.getHistory(session.id);
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
              await this.terminalSession.saveMessage(
                session.id,
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

      await this.terminalSession.touchSession(session);
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

    if (isCommand) {
      const user = client.user;
      if (user && user.sub) {
        const result = await this.terminalLimit.checkAndIncrementCommand(
          user.sub,
        );

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
        await this.terminalSession.clearHistory(sessionId);
        await this.terminalSession.saveMessage(sessionId, 'user', commandText);
      } else if (commandText) {
        await this.terminalSession.saveMessage(sessionId, 'user', commandText);
      }
    }

    this.ptyManager.write(sessionId, data.message);
    await this.terminalSession.updateActivity(sessionId);
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
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; title: string },
  ) {
    const session = await this.terminalSession.createNamedSession(
      data.userId,
      data.title,
    );
    client.emit('terminal:session-created', { sessionId: session.id });
    return session;
  }

  @SubscribeMessage('terminal:save-message')
  async handleSaveMessage(
    @ConnectedSocket() _client: Socket,
    @MessageBody()
    data: {
      sessionId: string;
      role: 'user' | 'assistant';
      content: string;
    },
  ) {
    await this.terminalSession.saveMessage(
      data.sessionId,
      data.role,
      data.content,
    );
    return { success: true };
  }

  @SubscribeMessage('terminal:load-session')
  async handleLoadSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ) {
    const session = await this.terminalSession.loadSessionWithMessages(
      data.sessionId,
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
  async handleClearHistory(@ConnectedSocket() client: Socket) {
    const sessionId = this.sessionMapper.getSessionId(client.id);
    if (!sessionId) return;

    this.logger.log(`[Terminal] Clearing history for session: ${sessionId}`);
    await this.terminalSession.clearHistory(sessionId);
    return { success: true };
  }

  @SubscribeMessage('terminal:close-session')
  async handleCloseSession(@ConnectedSocket() client: Socket) {
    const sessionId = this.sessionMapper.getSessionId(client.id);
    if (!sessionId) return;

    this.logger.log(`[Terminal] Explicitly closing session: ${sessionId}`);
    this.ptyManager.killPty(sessionId);
    await this.terminalSession.closeSession(sessionId);

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

    const session = await this.terminalSession.deleteSession(
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
