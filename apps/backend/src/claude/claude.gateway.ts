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
import { spawn, ChildProcess } from 'child_process';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from '../entities/session.entity';
import { Message } from '../entities/message.entity';

@Injectable()
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/claude',
})
export class ClaudeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private claudeProcesses = new Map<string, ChildProcess>();
  private sessionBuffers = new Map<string, string>(); // 세션별 출력 버퍼

  constructor(
    @InjectRepository(Session)
    private sessionRepo: Repository<Session>,
    @InjectRepository(Message)
    private messageRepo: Repository<Message>,
  ) {}

  handleConnection(client: Socket) {
    console.log(`[Claude] Client connected: ${client.id}`);

    // Claude Code 프로세스 시작
    const claude = spawn('claude', ['code'], {
      cwd: process.env.CLAUDE_WORKING_DIR || process.cwd(),
      env: { ...process.env },
      shell: true,
    });

    this.claudeProcesses.set(client.id, claude);

    // Claude 출력 → 클라이언트로 스트리밍
    claude.stdout.on('data', (data) => {
      client.emit('claude:output', {
        type: 'stdout',
        content: data.toString(),
      });
    });

    claude.stderr.on('data', (data) => {
      client.emit('claude:output', {
        type: 'stderr',
        content: data.toString(),
      });
    });

    claude.on('error', (error) => {
      client.emit('claude:error', { message: error.message });
    });

    claude.on('exit', (code) => {
      client.emit('claude:exit', { code });
      this.claudeProcesses.delete(client.id);
    });
  }

  handleDisconnect(client: Socket) {
    console.log(`[Claude] Client disconnected: ${client.id}`);

    // 프로세스 종료
    const claude = this.claudeProcesses.get(client.id);
    if (claude) {
      claude.kill();
      this.claudeProcesses.delete(client.id);
    }
  }

  @SubscribeMessage('claude:input')
  handleInput(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { message: string },
  ) {
    const claude = this.claudeProcesses.get(client.id);
    if (claude?.stdin) {
      claude.stdin.write(data.message + '\n');
    } else {
      client.emit('claude:error', { message: 'Claude process not found' });
    }
  }

  @SubscribeMessage('claude:interrupt')
  handleInterrupt(@ConnectedSocket() client: Socket) {
    const claude = this.claudeProcesses.get(client.id);
    if (claude) {
      claude.kill('SIGINT'); // Ctrl+C
    }
  }

  /**
   * 세션 생성 (히스토리 저장용)
   */
  @SubscribeMessage('claude:create-session')
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

    client.emit('claude:session-created', { sessionId: session.id });
    return session;
  }

  /**
   * 메시지 저장 (히스토리)
   */
  @SubscribeMessage('claude:save-message')
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
  @SubscribeMessage('claude:load-session')
  async handleLoadSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ) {
    const session = await this.sessionRepo.findOne({
      where: { id: data.sessionId },
      relations: ['messages'],
    });

    if (!session) {
      client.emit('claude:error', { message: 'Session not found' });
      return;
    }

    // 메시지 시간순 정렬
    const messages = session.messages.sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );

    client.emit('claude:session-loaded', {
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
  @SubscribeMessage('claude:slash-command')
  handleSlashCommand(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { command: string; args?: string[] },
  ) {
    const claude = this.claudeProcesses.get(client.id);
    if (!claude) {
      client.emit('claude:error', { message: 'Claude process not found' });
      return;
    }

    // 슬래시 명령어를 그대로 전달 (Claude Code가 해석)
    const commandStr = `/${data.command}${
      data.args ? ' ' + data.args.join(' ') : ''
    }\n`;

    claude.stdin?.write(commandStr);
    return { success: true };
  }
}
