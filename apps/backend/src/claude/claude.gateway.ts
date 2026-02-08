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
import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as pty from 'node-pty';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from '../entities/session.entity';
import { Message } from '../entities/message.entity';
import { JwtService } from '@nestjs/jwt';

@Injectable()
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/terminal',
})
export class ClaudeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private terminalProcesses = new Map<string, pty.IPty>();

  constructor(
    @InjectRepository(Session)
    private sessionRepo: Repository<Session>,
    @InjectRepository(Message)
    private messageRepo: Repository<Message>,
    private jwtService: JwtService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      // JWT 토큰 검증
      const token = client.handshake.auth.token;
      if (!token) {
        throw new UnauthorizedException('No token provided');
      }

      const payload = this.jwtService.verify(token);
      (client as any).user = payload; // 사용자 정보를 client에 저장

      console.log(
        `[Terminal] Client connected: ${client.id} (user: ${payload.email})`,
      );
    } catch (error) {
      console.error('[Terminal] Authentication failed:', error.message);
      client.emit('terminal:error', { message: '인증 실패: ' + error.message });
      client.disconnect();
      return;
    }

    // zsh 셸 시작 (PTY 사용) - 키보드 입력이 가능한 interactive shell
    console.log('[Terminal] Spawning interactive zsh shell with PTY...');
    const homeDir = process.env.HOME || '/Users/kscold';
    console.log('[Terminal] Using HOME:', homeDir);

    let shell: pty.IPty;
    try {
      // bash 사용 (zsh보다 안정적)
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

      this.terminalProcesses.set(client.id, shell);

      // 터미널 출력 → 클라이언트로 스트리밍
      shell.onData((data) => {
        client.emit('terminal:output', {
          type: 'stdout',
          content: data,
        });
      });

      shell.onExit(({ exitCode, signal }) => {
        console.log('[Terminal] Process exited:', { exitCode, signal });
        client.emit('terminal:exit', { code: exitCode });
        this.terminalProcesses.delete(client.id);
      });

      console.log('[Terminal] Interactive shell started successfully');
    } catch (error) {
      console.error('[Terminal] Failed to spawn zsh:', error);
      console.error('[Terminal] Error details:', {
        name: error.name,
        message: error.message,
      });
      client.emit('terminal:error', {
        message: 'Failed to start terminal: ' + error.message
      });
      client.disconnect();
      return;
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`[Terminal] Client disconnected: ${client.id}`);

    // 프로세스 종료
    const shell = this.terminalProcesses.get(client.id);
    if (shell) {
      shell.kill();
      this.terminalProcesses.delete(client.id);
    }
  }

  @SubscribeMessage('terminal:input')
  handleInput(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { message: string },
  ) {
    const shell = this.terminalProcesses.get(client.id);
    if (shell) {
      // PTY로 입력 전송 (모든 키 입력을 그대로 전송)
      shell.write(data.message);
    } else {
      client.emit('terminal:error', { message: 'Terminal process not found' });
    }
  }

  @SubscribeMessage('terminal:interrupt')
  handleInterrupt(@ConnectedSocket() client: Socket) {
    const shell = this.terminalProcesses.get(client.id);
    if (shell) {
      shell.kill('SIGINT'); // Ctrl+C
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
    const shell = this.terminalProcesses.get(client.id);
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
}
