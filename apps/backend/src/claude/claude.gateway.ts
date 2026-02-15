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
import * as pty from 'node-pty';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from '../entities/session.entity';
import { Message } from '../entities/message.entity';
import { JwtService } from '@nestjs/jwt';
import { User } from '../entities/user.entity';

@Injectable()
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/terminal',
})
export class ClaudeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // sessionId -> PTY process 매핑 (세션 유지를 위해)
  private terminalProcesses = new Map<string, pty.IPty>();
  // sessionId -> Set<socketId> 매핑 (다중 클라이언트 지원)
  private sessionClients = new Map<string, Set<string>>();
  // socketId -> sessionId 매핑 (빠른 조회)
  private clientSessions = new Map<string, string>();

  constructor(
    @InjectRepository(Session)
    private sessionRepo: Repository<Session>,
    @InjectRepository(Message)
    private messageRepo: Repository<Message>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private jwtService: JwtService,
  ) {}
  // 자동 세션 정리 제거 - 사용자가 명시적으로 닫거나 로그아웃할 때만 정리

  // 권한 체크 헬퍼 메소드
  private async checkPermission(
    client: Socket,
    requiredPermission: string,
  ): Promise<boolean> {
    const user = (client as any).user;
    if (!user || !user.sub) {
      return false;
    }

    // 사용자 정보와 권한 로드
    const userWithPermissions = await this.userRepo.findOne({
      where: { id: user.sub },
      relations: ['roles', 'roles.permissions'],
    });

    if (!userWithPermissions) {
      return false;
    }

    // 권한 확인
    const permissions = userWithPermissions.roles.flatMap((role) =>
      role.permissions.map((p) => p.name),
    );

    return permissions.includes(requiredPermission);
  }

  async handleConnection(client: Socket) {
    try {
      // JWT 토큰 검증
      const token = client.handshake.auth.token;
      if (!token) {
        throw new UnauthorizedException('No token provided');
      }

      const payload = this.jwtService.verify(token);
      (client as any).user = payload;

      // 터미널 접근 권한 확인
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

      // 클라이언트가 제공한 sessionId 확인 (재연결인 경우)
      const requestedSessionId = client.handshake.auth.sessionId;
      let session: Session | null = null;
      let isReconnect = false;

      if (requestedSessionId) {
        // 기존 세션 조회
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

      // 세션이 없으면 새로 생성
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

      // 클라이언트-세션 매핑 저장
      this.clientSessions.set(client.id, session.id);
      if (!this.sessionClients.has(session.id)) {
        this.sessionClients.set(session.id, new Set());
      }
      this.sessionClients.get(session.id)!.add(client.id);

      // 세션 ID를 클라이언트에 전송
      client.emit('terminal:session-ready', {
        sessionId: session.id,
        isReconnect,
      });

      let shell: pty.IPty;

      // 기존 PTY 프로세스가 있으면 재사용
      if (isReconnect && this.terminalProcesses.has(session.id)) {
        shell = this.terminalProcesses.get(session.id)!;
        console.log(
          `[Terminal] Reusing existing PTY for session: ${session.id}`,
        );

        // 재연결 시에는 기존 리스너를 재사용하므로 새로 추가하지 않음
        // onData는 이미 등록되어 있어서 자동으로 새 클라이언트에게도 전송됨
      } else {
        // 새 PTY 프로세스 생성
        const homeDir = process.env.HOME || '/Users/kscold';
        shell = pty.spawn('/bin/bash', ['-l'], {
          name: 'xterm-256color',
          cols: 100,
          rows: 30,
          cwd: homeDir,
          env: {
            ...process.env,
            HOME: homeDir,
            USER: process.env.USER || 'kscold',
            SHELL: '/bin/bash',
            TERM: 'xterm-256color',
          },
        });

        this.terminalProcesses.set(session.id, shell);

        // 터미널 출력 → 모든 연결된 클라이언트로 브로드캐스트
        shell.onData((data) => {
          const clients = this.sessionClients.get(session.id);
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
          console.log('[Terminal] Process exited:', { exitCode, signal });
          const clients = this.sessionClients.get(session.id);
          if (clients) {
            clients.forEach((clientId) => {
              this.server
                .to(clientId)
                .emit('terminal:exit', { code: exitCode });
            });
          }
          this.terminalProcesses.delete(session.id);
          this.sessionClients.delete(session.id);
        });

        console.log(`[Terminal] New PTY created for session: ${session.id}`);
      }

      // 세션 활동 시간 업데이트
      session.lastActivityAt = new Date();
      await this.sessionRepo.save(session);
    } catch (error) {
      console.error('[Terminal] Connection failed:', error.message);
      client.emit('terminal:error', { message: '연결 실패: ' + error.message });
      client.disconnect();
      return;
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`[Terminal] Client disconnected: ${client.id}`);

    const sessionId = this.clientSessions.get(client.id);
    if (sessionId) {
      // 세션에서 클라이언트 제거
      const clients = this.sessionClients.get(sessionId);
      if (clients) {
        clients.delete(client.id);
        console.log(
          `[Terminal] Removed client from session ${sessionId}. Remaining clients: ${clients.size}`,
        );

        // 더 이상 연결된 클라이언트가 없으면 세션은 유지하되 표시만
        if (clients.size === 0) {
          console.log(
            `[Terminal] No clients connected to session ${sessionId}. PTY process will remain active.`,
          );
          // PTY는 계속 실행 상태 유지 (재연결 가능)
        }
      }
      this.clientSessions.delete(client.id);
    }
  }

  @SubscribeMessage('terminal:input')
  async handleInput(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { message: string },
  ) {
    const sessionId = this.clientSessions.get(client.id);
    if (!sessionId) {
      client.emit('terminal:error', { message: 'Session not found' });
      return;
    }

    const shell = this.terminalProcesses.get(sessionId);
    if (shell) {
      // 명령어 입력인지 확인 (Enter 키 포함된 경우만)
      if (data.message.includes('\r') || data.message.includes('\n')) {
        const user = (client as any).user;
        if (user && user.sub) {
          // 사용자 명령어 제한 확인
          const userRecord = await this.userRepo.findOne({
            where: { id: user.sub },
          });
          if (userRecord) {
            // 제한이 설정된 경우 (-1이 아닌 경우)
            if (userRecord.terminalCommandLimit !== -1) {
              if (
                userRecord.terminalCommandCount >=
                userRecord.terminalCommandLimit
              ) {
                client.emit('terminal:error', {
                  message: `터미널 명령어 제한 (${userRecord.terminalCommandLimit}회)에 도달했습니다. 관리자에게 문의하세요.`,
                });
                client.emit('terminal:limit-reached', {
                  limit: userRecord.terminalCommandLimit,
                  count: userRecord.terminalCommandCount,
                });
                return;
              }

              // 명령어 카운트 증가
              userRecord.terminalCommandCount++;
              await this.userRepo.save(userRecord);

              const remaining =
                userRecord.terminalCommandLimit -
                userRecord.terminalCommandCount;
              client.emit('terminal:command-count', {
                count: userRecord.terminalCommandCount,
                limit: userRecord.terminalCommandLimit,
                remaining,
              });
            }
          }
        }
      }

      // PTY로 입력 전송
      shell.write(data.message);

      // 세션 활동 시간 업데이트
      await this.sessionRepo.update(sessionId, { lastActivityAt: new Date() });
    } else {
      client.emit('terminal:error', { message: 'Terminal process not found' });
    }
  }

  @SubscribeMessage('terminal:interrupt')
  handleInterrupt(@ConnectedSocket() client: Socket) {
    const sessionId = this.clientSessions.get(client.id);
    if (!sessionId) return;

    const shell = this.terminalProcesses.get(sessionId);
    if (shell) {
      shell.kill('SIGINT'); // Ctrl+C
    }
  }

  @SubscribeMessage('terminal:resize')
  handleResize(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { cols: number; rows: number },
  ) {
    const sessionId = this.clientSessions.get(client.id);
    if (!sessionId) return;

    const shell = this.terminalProcesses.get(sessionId);
    if (shell) {
      shell.resize(data.cols, data.rows);
    }
  }

  /**
   * 세션 생성 (히스토리 저장용)
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
   * 메시지 저장 (히스토리)
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
   * 세션 히스토리 불러오기
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

    // 메시지 시간순 정렬
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
   * / 슬래시 명령어 처리
   */
  @SubscribeMessage('terminal:slash-command')
  handleSlashCommand(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { command: string; args?: string[] },
  ) {
    const sessionId = this.clientSessions.get(client.id);
    if (!sessionId) {
      client.emit('terminal:error', { message: 'Session not found' });
      return;
    }

    const shell = this.terminalProcesses.get(sessionId);
    if (!shell) {
      client.emit('terminal:error', { message: 'Terminal process not found' });
      return;
    }

    // 슬래시 명령어를 그대로 전달
    const commandStr = `/${data.command}${
      data.args ? ' ' + data.args.join(' ') : ''
    }\n`;

    shell.write(commandStr);
    return { success: true };
  }

  /**
   * 세션 명시적 종료
   */
  @SubscribeMessage('terminal:close-session')
  async handleCloseSession(@ConnectedSocket() client: Socket) {
    const sessionId = this.clientSessions.get(client.id);
    if (!sessionId) return;

    console.log(`[Terminal] Explicitly closing session: ${sessionId}`);

    // PTY 프로세스 종료
    const shell = this.terminalProcesses.get(sessionId);
    if (shell) {
      shell.kill();
      this.terminalProcesses.delete(sessionId);
    }

    // 세션 비활성화
    await this.sessionRepo.update(sessionId, { isActive: false });

    // 모든 연결된 클라이언트에 알림
    const clients = this.sessionClients.get(sessionId);
    if (clients) {
      clients.forEach((clientId) => {
        this.server.to(clientId).emit('terminal:session-closed');
      });
    }

    // 매핑 정리
    this.sessionClients.delete(sessionId);
    if (clients) {
      clients.forEach((clientId) => {
        this.clientSessions.delete(clientId);
      });
    }

    return { success: true };
  }
}
