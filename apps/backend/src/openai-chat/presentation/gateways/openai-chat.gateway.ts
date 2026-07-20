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
  Logger,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import type { AuthenticatedSocket } from '../../../common/types/authenticated-socket.type';
import { PERMISSIONS } from '../../../common/constants/permissions';
// 권한 확인은 rbac 모듈의 책임
import { WsPermissionService } from '../../../rbac/application/services/ws-permission.service';

import { OpenAIApiService } from '../../application/services/openai-api.service';
import { CodexProcessManagerService } from '../../application/services/codex-process-manager.service';
import { OpenAISessionMapperService } from '../../application/services/openai-session-mapper.service';
import {
  GetOrCreateOpenAISessionUseCase,
  GetOpenAIHistoryUseCase,
  SaveOpenAIMessageUseCase,
  TouchOpenAISessionUseCase,
  CloseOpenAISessionUseCase,
} from '../../application/use-cases';

export type OpenAIProvider = 'api' | 'codex';

@Injectable()
@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3000' },
  namespace: '/openai-chat',
})
export class OpenAIChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(OpenAIChatGateway.name);
  private readonly clientProviders = new Map<string, OpenAIProvider>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly openAIApi: OpenAIApiService,
    private readonly codexManager: CodexProcessManagerService,
    private readonly sessionMapper: OpenAISessionMapperService,
    private readonly wsPermission: WsPermissionService,
    private readonly getOrCreateSessionUseCase: GetOrCreateOpenAISessionUseCase,
    private readonly getHistoryUseCase: GetOpenAIHistoryUseCase,
    private readonly saveMessageUseCase: SaveOpenAIMessageUseCase,
    private readonly touchSessionUseCase: TouchOpenAISessionUseCase,
    private readonly closeSessionUseCase: CloseOpenAISessionUseCase,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = client.handshake.auth.token;
      if (!token) throw new UnauthorizedException('No token');

      const payload = this.jwtService.verify(token);
      client.user = payload;

      const hasAccess = await this.wsPermission.checkPermission(
        payload.sub,
        PERMISSIONS.TERMINAL_ACCESS,
      );
      if (!hasAccess)
        throw new ForbiddenException('터미널 접근 권한이 없습니다');

      const provider: OpenAIProvider =
        client.handshake.auth.provider === 'codex' ? 'codex' : 'api';
      this.clientProviders.set(client.id, provider);

      const { session, isReconnect } =
        await this.getOrCreateSessionUseCase.execute(
          payload.sub,
          provider,
          client.handshake.auth.sessionId,
        );

      this.sessionMapper.mapClientToSession(client.id, session.id);
      this.logger.log(`[OpenAIChat] Connected: ${client.id} (${provider})`);

      client.emit('openai:session-ready', {
        sessionId: session.id,
        isReconnect,
        provider,
        model: this.openAIApi.getModel(),
        apiConfigured: this.openAIApi.isApiKeyConfigured(),
        workingDirectory: this.codexManager.getWorkingDirectory(),
      });

      if (isReconnect) {
        const messages = await this.getHistoryUseCase.execute(
          session.id,
          payload.sub,
        );
        if (messages.length > 0) {
          client.emit('openai:history', {
            messages: messages.map((m) => ({
              role: m.role,
              content: m.content,
              metadata: m.metadata,
              timestamp: m.timestamp,
            })),
          });
        }
      }
    } catch (err: any) {
      this.logger.error('[OpenAIChat] Connection failed:', err.message);
      client.emit('openai:error', { message: '연결 실패: ' + err.message });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`[OpenAIChat] Disconnected: ${client.id}`);
    this.clientProviders.delete(client.id);
    this.sessionMapper.unmapClient(client.id);
  }

  private emit(sessionId: string, event: string, payload: any) {
    const clients = this.sessionMapper.getClients(sessionId);
    clients?.forEach((cid) => this.server.to(cid).emit(event, payload));
  }

  @SubscribeMessage('openai:send-message')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { message: string; provider?: OpenAIProvider },
  ) {
    const sessionId = this.sessionMapper.getSessionId(client.id);
    if (!sessionId) {
      client.emit('openai:error', { message: 'Session not found' });
      return;
    }

    if (!client.user?.sub) {
      client.emit('openai:error', { message: 'Unauthorized' });
      return;
    }

    const provider =
      data.provider ?? this.clientProviders.get(client.id) ?? 'api';

    if (provider === 'api' && !this.openAIApi.isApiKeyConfigured()) {
      client.emit('openai:error', {
        message:
          'OPENAI_API_KEY가 설정되지 않았습니다. 환경 변수를 확인하세요.',
      });
      return;
    }

    await this.saveMessageUseCase.execute(
      sessionId,
      client.user.sub,
      'user',
      data.message,
    );

    this.emit(sessionId, 'openai:message-start', {
      messageId: Date.now().toString(),
      provider,
    });

    let fullContent = '';
    let messageEnded = false;

    const handleEnd = async (content: string, meta?: Record<string, any>) => {
      if (messageEnded) return;
      messageEnded = true;

      await this.saveMessageUseCase.execute(
        sessionId,
        client.user.sub,
        'assistant',
        content,
        {
          type: 'openai-chat',
          provider,
          ...meta,
        },
      );

      this.emit(sessionId, 'openai:message-end', {
        content,
        provider,
        ...meta,
      });
      fullContent = '';
      this.touchSessionUseCase
        .execute(sessionId, client.user.sub)
        .catch(() => {});
    };

    const safeHandleEnd = (content: string, meta?: Record<string, any>) => {
      handleEnd(content, meta).catch((e) =>
        this.logger.error('[OpenAIChat] handleEnd failed', e),
      );
    };

    if (provider === 'codex') {
      this.codexManager.sendPrompt(sessionId, data.message, (event) => {
        switch (event.type) {
          case 'text-delta':
            fullContent += event.text ?? '';
            this.emit(sessionId, 'openai:text-delta', { text: event.text });
            break;
          case 'message-end':
            safeHandleEnd(event.content ?? fullContent);
            break;
          case 'error':
            this.emit(sessionId, 'openai:error', { message: event.message });
            break;
          case 'process-exit':
            if (!messageEnded) safeHandleEnd(fullContent);
            break;
        }
      });
    } else {
      await this.openAIApi.sendMessage(sessionId, data.message, (event) => {
        switch (event.type) {
          case 'text-delta':
            fullContent += event.text ?? '';
            this.emit(sessionId, 'openai:text-delta', { text: event.text });
            break;
          case 'message-end':
            safeHandleEnd(event.content ?? fullContent, { model: event.model });
            break;
          case 'error':
            this.emit(sessionId, 'openai:error', { message: event.message });
            break;
          case 'done':
            if (!messageEnded) safeHandleEnd(fullContent);
            break;
        }
      });
    }
  }

  @SubscribeMessage('openai:abort')
  handleAbort(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { provider?: OpenAIProvider },
  ) {
    const sessionId = this.sessionMapper.getSessionId(client.id);
    if (!sessionId) return;
    const provider =
      data?.provider ?? this.clientProviders.get(client.id) ?? 'api';
    if (provider === 'codex') {
      this.codexManager.abort(sessionId);
    } else {
      this.openAIApi.abort(sessionId);
    }
  }

  @SubscribeMessage('openai:close-session')
  async handleCloseSession(@ConnectedSocket() client: AuthenticatedSocket) {
    const sessionId = this.sessionMapper.getSessionId(client.id);
    if (!sessionId) return;
    if (!client.user?.sub) {
      client.emit('openai:error', { message: 'Unauthorized' });
      return;
    }

    this.codexManager.kill(sessionId);
    this.openAIApi.abort(sessionId);
    this.openAIApi.clearHistory(sessionId);
    await this.closeSessionUseCase.execute(sessionId, client.user.sub);

    const clients = this.sessionMapper.getClients(sessionId);
    clients?.forEach((cid) => {
      if (cid !== client.id) this.server.to(cid).emit('openai:session-closed');
    });
    this.sessionMapper.clearSession(sessionId);

    const provider = this.clientProviders.get(client.id) ?? 'api';
    const { session: newSession } =
      await this.getOrCreateSessionUseCase.execute(client.user.sub, provider);

    this.sessionMapper.mapClientToSession(client.id, newSession.id);
    client.emit('openai:session-ready', {
      sessionId: newSession.id,
      isReconnect: false,
      provider,
      model: this.openAIApi.getModel(),
      apiConfigured: this.openAIApi.isApiKeyConfigured(),
    });

    return { success: true };
  }
}
