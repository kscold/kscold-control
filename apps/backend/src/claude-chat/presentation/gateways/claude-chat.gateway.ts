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
  Inject,
  Logger,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { PERMISSIONS } from '../../../common/constants/permissions';
import type { ISessionRepository } from '../../../terminal/domain/interfaces/session.repository.interface';
import { SESSION_REPOSITORY } from '../../../terminal/domain/interfaces/session.repository.interface';
import type { IMessageRepository } from '../../../terminal/domain/interfaces/message.repository.interface';
import { MESSAGE_REPOSITORY } from '../../../terminal/domain/interfaces/message.repository.interface';
import { WsPermissionService } from '../../../terminal/application/services/ws-permission.service';
import {
  ClaudeProcessManagerService,
  ClaudeStreamEvent,
} from '../../application/services/claude-process-manager.service';
import { ClaudeSessionMapperService } from '../../application/services/claude-session-mapper.service';

@Injectable()
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/claude-chat',
})
export class ClaudeChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ClaudeChatGateway.name);

  constructor(
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepo: ISessionRepository,
    @Inject(MESSAGE_REPOSITORY)
    private readonly messageRepo: IMessageRepository,
    private readonly jwtService: JwtService,
    private readonly processManager: ClaudeProcessManagerService,
    private readonly sessionMapper: ClaudeSessionMapperService,
    private readonly wsPermission: WsPermissionService,
  ) {}

  private async checkPermission(
    client: AuthenticatedSocket,
    requiredPermission: string,
  ): Promise<boolean> {
    const user = client.user;
    if (!user?.sub) return false;
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
        `[ClaudeChat] Client connected: ${client.id} (user: ${payload.email})`,
      );

      const requestedSessionId = client.handshake.auth.sessionId;
      let isReconnect = false;

      let existingSession = requestedSessionId
        ? await this.sessionRepo.findActive(requestedSessionId, payload.sub)
        : null;

      if (existingSession) {
        isReconnect = true;
      } else {
        existingSession = await this.sessionRepo.save(
          this.sessionRepo.create({
            userId: payload.sub,
            title: `Claude Chat ${new Date().toLocaleString()}`,
            isActive: true,
            lastActivityAt: new Date(),
          }),
        );
      }

      const session = existingSession;

      this.sessionMapper.mapClientToSession(client.id, session.id);

      client.emit('claude:session-ready', {
        sessionId: session.id,
        isReconnect,
        workingDirectory: this.processManager.getWorkingDirectory(),
      });

      if (isReconnect) {
        const messages = await this.messageRepo.findBySession(session.id);
        if (messages.length > 0) {
          client.emit('claude:history', {
            messages: messages.map((m) => ({
              role: m.role,
              content: m.content,
              metadata: m.metadata,
              timestamp: m.timestamp,
            })),
          });
        }
      }
    } catch (error) {
      this.logger.error('[ClaudeChat] Connection failed:', error.message);
      client.emit('claude:error', { message: '연결 실패: ' + error.message });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`[ClaudeChat] Client disconnected: ${client.id}`);
    this.sessionMapper.unmapClient(client.id);
  }

  @SubscribeMessage('claude:send-message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { message: string },
  ) {
    const sessionId = this.sessionMapper.getSessionId(client.id);
    if (!sessionId) {
      client.emit('claude:error', { message: 'Session not found' });
      return;
    }

    if (this.processManager.isProcessing(sessionId)) {
      client.emit('claude:error', { message: '이전 요청 처리 중입니다' });
      return;
    }

    const userMsg = this.messageRepo.create({
      sessionId,
      role: 'user',
      content: data.message,
    });
    await this.messageRepo.save(userMsg);

    const clients = this.sessionMapper.getClients(sessionId);
    const emit = (event: string, payload: any) => {
      if (clients) {
        clients.forEach((cid) => this.server.to(cid).emit(event, payload));
      }
    };

    emit('claude:message-start', { messageId: Date.now().toString() });

    let fullContent = '';
    let messageEnded = false;

    this.processManager.sendPrompt(
      sessionId,
      data.message,
      (event: ClaudeStreamEvent) => {
        switch (event.type) {
          case 'text-delta':
            fullContent += event.text;
            emit('claude:text-delta', { text: event.text });
            break;

          case 'tool-use':
            emit('claude:tool-use', {
              tool: event.tool,
              input: event.input,
              status: event.status,
            });
            break;

          case 'message-end': {
            if (messageEnded) break;
            messageEnded = true;

            const assistantMsg = this.messageRepo.create({
              sessionId,
              role: 'assistant',
              content: event.content || fullContent,
              metadata: {
                type: 'claude-chat',
                costUsd: event.costUsd,
                durationMs: event.durationMs,
                totalCostUsd: event.totalCostUsd,
              },
            });
            this.messageRepo.save(assistantMsg).catch((err) => {
              this.logger.error('[ClaudeChat] Failed to save message:', err);
            });

            emit('claude:message-end', {
              content: event.content || fullContent,
              costUsd: event.costUsd,
              durationMs: event.durationMs,
              totalCostUsd: event.totalCostUsd,
            });
            fullContent = '';

            this.sessionRepo.updateActivity(sessionId).catch(() => {});
            break;
          }

          case 'error':
            emit('claude:error', { message: event.message });
            break;

          case 'process-exit':
            // 정상 종료(message-end 이미 발행)가 아닌 경우 → 무조건 message-end 발행해 무한 로딩 방지
            if (!messageEnded) {
              messageEnded = true;
              emit('claude:message-end', {
                content: fullContent,
                costUsd: 0,
                durationMs: 0,
                totalCostUsd: this.processManager.getTotalCostUsd(sessionId),
              });
              fullContent = '';
            }
            break;
        }
      },
    );
  }

  @SubscribeMessage('claude:abort')
  handleAbort(@ConnectedSocket() client: Socket) {
    const sessionId = this.sessionMapper.getSessionId(client.id);
    if (sessionId) this.processManager.abort(sessionId);
  }

  @SubscribeMessage('claude:close-session')
  async handleCloseSession(@ConnectedSocket() client: Socket) {
    const sessionId = this.sessionMapper.getSessionId(client.id);
    if (!sessionId) return;

    this.processManager.kill(sessionId);
    await this.sessionRepo.deactivate(sessionId);

    // 공유 세션의 다른 클라이언트에만 알림 (요청 클라이언트 제외)
    const clients = this.sessionMapper.getClients(sessionId);
    if (clients) {
      clients.forEach((cid) => {
        if (cid !== client.id) {
          this.server.to(cid).emit('claude:session-closed');
        }
      });
    }
    this.sessionMapper.clearSession(sessionId);

    // 요청 클라이언트에 새 세션 즉시 생성
    const user = (client as AuthenticatedSocket).user;
    const newSession = await this.sessionRepo.save(
      this.sessionRepo.create({
        userId: user.sub,
        title: `Claude Chat ${new Date().toLocaleString()}`,
        isActive: true,
        lastActivityAt: new Date(),
      }),
    );
    this.sessionMapper.mapClientToSession(client.id, newSession.id);
    client.emit('claude:session-ready', {
      sessionId: newSession.id,
      isReconnect: false,
      workingDirectory: this.processManager.getWorkingDirectory(),
    });

    return { success: true };
  }
}
