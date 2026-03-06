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
import {
  Injectable,
  Inject,
  Logger,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../../rbac/domain/repositories/user.repository.interface';
import { PermissionExtractor } from '../../../common/utils/permission-extractor.util';
import type { ISessionRepository } from '../../../terminal/domain/interfaces/session.repository.interface';
import { SESSION_REPOSITORY } from '../../../terminal/domain/interfaces/session.repository.interface';
import type { IMessageRepository } from '../../../terminal/domain/interfaces/message.repository.interface';
import { MESSAGE_REPOSITORY } from '../../../terminal/domain/interfaces/message.repository.interface';
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
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepo: ISessionRepository,
    @Inject(MESSAGE_REPOSITORY)
    private readonly messageRepo: IMessageRepository,
    private readonly jwtService: JwtService,
    private readonly processManager: ClaudeProcessManagerService,
    private readonly sessionMapper: ClaudeSessionMapperService,
  ) {}

  private async checkPermission(
    client: Socket,
    requiredPermission: string,
  ): Promise<boolean> {
    const user = (client as any).user;
    if (!user?.sub) return false;

    const userWithPermissions = await this.userRepository.findByIdWithRoles(
      user.sub,
    );
    if (!userWithPermissions) return false;

    const permissions = PermissionExtractor.extractFromRoles(
      userWithPermissions.roles,
    );
    return permissions.includes(requiredPermission);
  }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token;
      if (!token) throw new UnauthorizedException('No token provided');

      const payload = this.jwtService.verify(token);
      (client as any).user = payload;

      const hasPermission = await this.checkPermission(
        client,
        'terminal:access',
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

      client.emit('claude:session-ready', { sessionId: session.id, isReconnect });

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

    const clients = this.sessionMapper.getClients(sessionId);
    if (clients) {
      clients.forEach((cid) =>
        this.server.to(cid).emit('claude:session-closed'),
      );
    }
    this.sessionMapper.clearSession(sessionId);

    return { success: true };
  }
}
