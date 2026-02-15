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
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';

// Domain
import { Session } from '../../domain/entities/session.entity';
import { Message } from '../../domain/entities/message.entity';

// Application Services
import {
  PtyManagerService,
  SessionMapperService,
  TerminalLimitService,
} from '../../application/services';

// RBAC
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../../rbac/domain/repositories/user.repository.interface';
import { PermissionExtractor } from '../../../common/utils/permission-extractor.util';
import { Inject } from '@nestjs/common';

/**
 * Terminal Gateway
 * Presentation layer - handles WebSocket connections only
 * Delegates business logic to application services
 */
@Injectable()
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/terminal',
})
export class TerminalGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    @InjectRepository(Session)
    private readonly sessionRepo: Repository<Session>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly jwtService: JwtService,
    private readonly ptyManager: PtyManagerService,
    private readonly sessionMapper: SessionMapperService,
    private readonly terminalLimit: TerminalLimitService,
  ) {}

  /**
   * Check if user has required permission
   */
  private async checkPermission(
    client: Socket,
    requiredPermission: string,
  ): Promise<boolean> {
    const user = (client as any).user;
    if (!user || !user.sub) {
      return false;
    }

    const userWithPermissions = await this.userRepository.findByIdWithRoles(
      user.sub,
    );
    if (!userWithPermissions) {
      return false;
    }

    const permissions = PermissionExtractor.extractFromRoles(
      userWithPermissions.roles,
    );
    return permissions.includes(requiredPermission);
  }

  /**
   * Handle new WebSocket connection
   */
  async handleConnection(client: Socket) {
    try {
      // Verify JWT token
      const token = client.handshake.auth.token;
      if (!token) {
        throw new UnauthorizedException('No token provided');
      }

      const payload = this.jwtService.verify(token);
      (client as any).user = payload;

      // Check terminal access permission
      const hasPermission = await this.checkPermission(
        client,
        'terminal:access',
      );
      if (!hasPermission) {
        throw new ForbiddenException('터미널 접근 권한이 없습니다');
      }

      console.log(
        `[Terminal] Client connected: ${client.id} (user: ${payload.email})`,
      );

      // Check for session reconnection
      const requestedSessionId = client.handshake.auth.sessionId;
      let session: Session | null = null;
      let isReconnect = false;

      if (requestedSessionId) {
        session = await this.sessionRepo.findOne({
          where: {
            id: requestedSessionId,
            userId: payload.sub,
            isActive: true,
          },
        });
        if (session) {
          isReconnect = true;
          console.log(`[Terminal] Reconnecting to session: ${session.id}`);
        }
      }

      // Create new session if not reconnecting
      if (!session) {
        session = this.sessionRepo.create({
          userId: payload.sub,
          title: `Terminal ${new Date().toLocaleString()}`,
          isActive: true,
          lastActivityAt: new Date(),
        });
        await this.sessionRepo.save(session);
        console.log(`[Terminal] Created new session: ${session.id}`);
      }

      // Map client to session
      this.sessionMapper.mapClientToSession(client.id, session.id);

      // Emit session ready
      client.emit('terminal:session-ready', {
        sessionId: session.id,
        isReconnect,
      });

      // Load and send message history if reconnecting
      if (isReconnect) {
        const messages = await this.messageRepo.find({
          where: { sessionId: session.id },
          order: { timestamp: 'ASC' },
        });

        if (messages.length > 0) {
          console.log(
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

      // Get or create PTY process
      let shell = this.ptyManager.getPty(session.id);
      if (isReconnect && shell) {
        console.log(
          `[Terminal] Reusing existing PTY for session: ${session.id}`,
        );
      } else {
        try {
          shell = this.ptyManager.createPty(session.id);

          // Setup PTY event handlers
          shell.onData(async (data) => {
            // Save output to database
            try {
              const message = this.messageRepo.create({
                sessionId: session!.id,
                role: 'system',
                content: data,
              });
              await this.messageRepo.save(message);
            } catch (err) {
              console.error('[Terminal] Failed to save output to DB:', err);
            }

            // Emit to all connected clients
            const clients = this.sessionMapper.getClients(session!.id);
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
            console.error(
              `[Terminal] PTY process exited unexpectedly for session ${session!.id}:`,
              { exitCode, signal },
            );
            const clients = this.sessionMapper.getClients(session!.id);
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
            this.ptyManager.deletePty(session!.id);
            this.sessionMapper.clearSession(session!.id);
          });

          console.log(`[Terminal] PTY setup complete for session: ${session.id}`);
        } catch (ptyError) {
          console.error(
            `[Terminal] Failed to create PTY for session ${session.id}:`,
            ptyError,
          );
          throw new Error('PTY 프로세스 생성 실패: ' + ptyError.message);
        }
      }

      // Update session activity
      session.lastActivityAt = new Date();
      await this.sessionRepo.save(session);
    } catch (error) {
      console.error('[Terminal] Connection failed:', error.message);
      client.emit('terminal:error', {
        message: '연결 실패: ' + error.message,
      });
      client.disconnect();
    }
  }

  /**
   * Handle WebSocket disconnection
   */
  handleDisconnect(client: Socket) {
    console.log(`[Terminal] Client disconnected: ${client.id}`);
    this.sessionMapper.unmapClient(client.id);
  }

  /**
   * Handle terminal input from client
   */
  @SubscribeMessage('terminal:input')
  async handleInput(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { message: string },
  ) {
    const sessionId = this.sessionMapper.getSessionId(client.id);
    if (!sessionId) {
      client.emit('terminal:error', { message: 'Session not found' });
      return;
    }

    // Check if this is a command (contains Enter key)
    const isCommand =
      data.message.includes('\r') || data.message.includes('\n');

    if (isCommand) {
      const user = (client as any).user;
      if (user && user.sub) {
        // Check and increment command limit
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

        // Emit command count update
        client.emit('terminal:command-count', {
          count: result.count,
          limit: result.limit,
          remaining: result.remaining,
        });
      }

      // Save user input to database (only complete commands, not every keystroke)
      try {
        // Extract the command text (remove control characters)
        const commandText = data.message.replace(/[\r\n]/g, '').trim();

        // Check if user typed 'clear' command - if so, clear the history
        if (commandText === 'clear') {
          console.log(
            `[Terminal] User typed 'clear', deleting history for session: ${sessionId}`,
          );
          await this.messageRepo.delete({ sessionId });

          // Save the clear command itself
          const message = this.messageRepo.create({
            sessionId,
            role: 'user',
            content: commandText,
          });
          await this.messageRepo.save(message);
        } else if (commandText) {
          // Save normal commands
          const message = this.messageRepo.create({
            sessionId,
            role: 'user',
            content: commandText,
          });
          await this.messageRepo.save(message);
        }
      } catch (err) {
        console.error('[Terminal] Failed to save input to DB:', err);
      }
    }

    // Write to PTY
    this.ptyManager.write(sessionId, data.message);

    // Update session activity
    await this.sessionRepo.update(sessionId, { lastActivityAt: new Date() });
  }

  /**
   * Handle terminal interrupt (Ctrl+C)
   */
  @SubscribeMessage('terminal:interrupt')
  handleInterrupt(@ConnectedSocket() client: Socket) {
    const sessionId = this.sessionMapper.getSessionId(client.id);
    if (sessionId) {
      this.ptyManager.interrupt(sessionId);
    }
  }

  /**
   * Handle terminal resize
   */
  @SubscribeMessage('terminal:resize')
  handleResize(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { cols: number; rows: number },
  ) {
    const sessionId = this.sessionMapper.getSessionId(client.id);
    if (sessionId) {
      this.ptyManager.resize(sessionId, data.cols, data.rows);
    }
  }

  /**
   * Create session (for history)
   */
  @SubscribeMessage('terminal:create-session')
  async handleCreateSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; title: string },
  ) {
    const session = this.sessionRepo.create({
      userId: data.userId,
      title: data.title || 'New Session',
      isActive: true,
    });
    await this.sessionRepo.save(session);

    client.emit('terminal:session-created', { sessionId: session.id });
    return session;
  }

  /**
   * Save message (for history)
   */
  @SubscribeMessage('terminal:save-message')
  async handleSaveMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      sessionId: string;
      role: 'user' | 'assistant';
      content: string;
    },
  ) {
    const message = this.messageRepo.create({
      sessionId: data.sessionId,
      role: data.role,
      content: data.content,
    });
    await this.messageRepo.save(message);
    return { success: true };
  }

  /**
   * Load session history
   */
  @SubscribeMessage('terminal:load-session')
  async handleLoadSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ) {
    const session = await this.sessionRepo.findOne({
      where: { id: data.sessionId },
      relations: ['messages'],
    });

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

  /**
   * Handle slash commands
   */
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

  /**
   * Clear terminal history (when user types 'clear')
   */
  @SubscribeMessage('terminal:clear-history')
  async handleClearHistory(@ConnectedSocket() client: Socket) {
    const sessionId = this.sessionMapper.getSessionId(client.id);
    if (!sessionId) return;

    console.log(`[Terminal] Clearing history for session: ${sessionId}`);

    // Delete all messages for this session
    await this.messageRepo.delete({ sessionId });

    return { success: true };
  }

  /**
   * Close session explicitly
   */
  @SubscribeMessage('terminal:close-session')
  async handleCloseSession(@ConnectedSocket() client: Socket) {
    const sessionId = this.sessionMapper.getSessionId(client.id);
    if (!sessionId) return;

    console.log(`[Terminal] Explicitly closing session: ${sessionId}`);

    // Kill PTY process
    this.ptyManager.killPty(sessionId);

    // Deactivate session
    await this.sessionRepo.update(sessionId, { isActive: false });

    // Notify all connected clients
    const clients = this.sessionMapper.getClients(sessionId);
    if (clients) {
      clients.forEach((clientId) => {
        this.server.to(clientId).emit('terminal:session-closed');
      });
    }

    // Clear mappings
    this.sessionMapper.clearSession(sessionId);

    return { success: true };
  }

  /**
   * Delete session and its history permanently
   */
  @SubscribeMessage('terminal:delete-session')
  async handleDeleteSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ) {
    const user = (client as any).user;
    if (!user || !user.sub) {
      client.emit('terminal:error', { message: 'Unauthorized' });
      return;
    }

    // Verify session belongs to user
    const session = await this.sessionRepo.findOne({
      where: { id: data.sessionId, userId: user.sub },
    });

    if (!session) {
      client.emit('terminal:error', { message: 'Session not found' });
      return;
    }

    console.log(`[Terminal] Deleting session: ${data.sessionId}`);

    // Delete messages (will cascade delete due to FK constraint)
    await this.messageRepo.delete({ sessionId: data.sessionId });

    // Delete session
    await this.sessionRepo.delete(data.sessionId);

    // Kill PTY if running
    this.ptyManager.killPty(data.sessionId);

    // Clear mappings
    this.sessionMapper.clearSession(data.sessionId);

    return { success: true };
  }
}
