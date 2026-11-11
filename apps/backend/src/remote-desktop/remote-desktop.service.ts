import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { createConnection, type Socket } from 'node:net';
import { StringDecoder } from 'node:string_decoder';
import type { Server, IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, WebSocket, createWebSocketStream } from 'ws';
import {
  USER_REPOSITORY,
  IUserRepository,
} from '../rbac/domain/repositories/user.repository.interface';
import type { JwtPayload } from '../common/types/jwt-request.type';
import { isGlobalAdministrator } from '../common/utils/role-access.util';
import { SessionVerifier } from '../auth/application/services/session-verifier.service';
import { SessionConnectionRegistry } from '../auth/application/services/session-connection-registry.service';
import type {
  DesktopConnection,
  DesktopProtocol,
} from './remote-desktop-targets.service';
import {
  encodeInstruction,
  InstructionReader,
  rdpHandshake,
} from './guacamole';

const PATHS: Record<DesktopProtocol, string> = {
  vnc: '/api/remote-desktop/socket',
  rdp: '/api/remote-desktop/guac',
};

interface DesktopTicket {
  userId: string;
  sessionId: string;
  expires: number;
  protocol: DesktopProtocol;
  host: string;
  port: number;
  // RDP 계정은 브라우저로 보내지 않고 서버가 guacd 에 직접 넘김.
  credentials?: { username: string; password: string };
}

export function canControlDesktop(
  user: Pick<JwtPayload, 'roles' | 'impersonation'>,
): boolean {
  return !user.impersonation && isGlobalAdministrator(user.roles);
}

@Injectable()
export class RemoteDesktopService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(RemoteDesktopService.name);
  private readonly tickets = new Map<string, DesktopTicket>();
  private readonly sockets = new Set<WebSocket>();
  private readonly cleanup = new Map<WebSocket, () => void>();
  private readonly pending = new Set<Duplex>();
  private stopping = false;
  private server?: Server;
  private readonly ws = new WebSocketServer({
    noServer: true,
    maxPayload: 1024 * 1024,
    perMessageDeflate: false,
    handleProtocols: (protocols) =>
      protocols.has('guacamole') ? 'guacamole' : 'binary',
  });

  constructor(
    private readonly adapter: HttpAdapterHost,
    private readonly config: ConfigService,
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    private readonly sessionVerifier: SessionVerifier,
    private readonly sessionConnections: SessionConnectionRegistry,
  ) {}

  issue(user: JwtPayload, connection?: DesktopConnection) {
    if (!canControlDesktop(user))
      throw new ForbiddenException(
        '관리자 본인 계정으로만 원격 접속할 수 있습니다.',
      );
    const settings = this.settings();
    const protocol = connection?.protocol ?? 'vnc';
    if (protocol === 'rdp') this.guacd();
    const now = Date.now();
    for (const [key, value] of this.tickets) {
      if (value.expires <= now || value.userId === user.id)
        this.tickets.delete(key);
    }
    if (this.tickets.size >= 100 || this.sockets.size >= 3)
      throw new ServiceUnavailableException('원격 연결이 사용 중입니다.');
    const ticket = randomBytes(32).toString('hex');
    this.tickets.set(ticket, {
      userId: user.id,
      sessionId: user.sessionId,
      expires: now + 30_000,
      protocol,
      host: connection?.host || '127.0.0.1',
      port: connection?.port ?? settings.port,
      ...(protocol === 'rdp' && connection?.credentials
        ? { credentials: connection.credentials }
        : {}),
    });
    if (protocol === 'rdp') return { ticket, protocol, suggestedUsername: '' };
    return {
      ticket,
      protocol,
      suggestedUsername:
        !connection || connection.id === 'local'
          ? this.config.get<string>('REMOTE_DESKTOP_USERNAME') || ''
          : '',
      ...(connection?.credentials
        ? { credentials: connection.credentials }
        : {}),
    };
  }

  private settings() {
    const origin = this.config.get<string>('REMOTE_DESKTOP_ORIGIN');
    const port = Number(
      this.config.get<string>('REMOTE_DESKTOP_PORT') || '5900',
    );
    if (
      this.config.get<string>('REMOTE_DESKTOP_ENABLED') !== 'true' ||
      !origin ||
      !Number.isInteger(port) ||
      port < 1 ||
      port > 65535
    ) {
      throw new ServiceUnavailableException(
        '원격 데스크톱이 설정되지 않았습니다.',
      );
    }
    const url = new URL(origin);
    if (
      url.origin !== origin ||
      (url.protocol !== 'https:' && url.hostname !== 'localhost')
    )
      throw new ServiceUnavailableException(
        '원격 접속 Origin 설정을 확인하세요.',
      );
    return { origin, port };
  }

  private guacd() {
    const host = this.config.get<string>('GUACD_HOST');
    const port = Number(this.config.get<string>('GUACD_PORT') || '4822');
    if (!host || !Number.isInteger(port) || port < 1 || port > 65535)
      throw new ServiceUnavailableException(
        'RDP 중계 서버(guacd)가 설정되지 않았습니다. GUACD_HOST 를 확인하세요.',
      );
    return { host, port };
  }

  onApplicationBootstrap() {
    const server: Server = this.adapter.httpAdapter.getHttpServer();
    this.server = server;
    server.on('upgrade', this.upgrade);
  }

  private readonly upgrade = (
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ) => {
    const path = request.url?.split('?')[0];
    if (path !== PATHS.vnc && path !== PATHS.rdp) return;
    if (this.stopping || this.pending.size >= 100) {
      socket.destroy();
      return;
    }
    this.pending.add(socket);
    const timeout = setTimeout(() => socket.destroy(), 5_000);
    const release = () => {
      clearTimeout(timeout);
      this.pending.delete(socket);
      socket.off('close', release);
    };
    socket.once('close', release);
    void this.accept(request, socket, head)
      .catch(() => {
        if (!socket.destroyed)
          socket.end(
            'HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n',
            () => socket.destroy(),
          );
      })
      .finally(release);
  };

  private async accept(request: IncomingMessage, socket: Duplex, head: Buffer) {
    const { origin } = this.settings();
    if (request.headers.origin !== origin || this.sockets.size >= 3)
      throw new Error('Rejected');
    const protocols = (request.headers['sec-websocket-protocol'] || '')
      .split(',')
      .map((value) => value.trim());
    // guacamole-common-js 터널은 하위 프로토콜을 'guacamole' 하나로 고정하고 주소 뒤에 "?" + 데이터를 붙임.
    // 그래서 RDP 표는 한 번 쓰고 30초 안에 만료되는 값을 쿼리로 받음.
    const rdp = request.url?.match(
      /^\/api\/remote-desktop\/guac\?ticket=([a-f0-9]{64})$/,
    );
    const key =
      request.url === PATHS.vnc
        ? protocols
            .find((value) => /^ticket\.[a-f0-9]{64}$/.test(value))
            ?.slice(7)
        : rdp?.[1];
    const ticket = key ? this.tickets.get(key) : undefined;
    if (key) this.tickets.delete(key);
    if (
      !ticket ||
      ticket.expires <= Date.now() ||
      !protocols.includes(ticket.protocol === 'rdp' ? 'guacamole' : 'binary') ||
      (ticket.protocol === 'rdp') !== Boolean(rdp)
    )
      throw new Error('Rejected');
    const user = await this.users.findByIdWithRoles(ticket.userId);
    if (!user) throw new Error('Rejected');
    await this.sessionVerifier.verifyClaims({
      sub: ticket.userId,
      sid: ticket.sessionId,
      roles: user.roles.map((role) => role.name),
    });
    if (
      !isGlobalAdministrator(user.roles) ||
      this.stopping ||
      socket.destroyed ||
      this.sockets.size >= 3
    )
      throw new Error('Rejected');
    this.ws.handleUpgrade(request, socket, head, (client) =>
      this.connect(client, ticket),
    );
  }

  private connect(client: WebSocket, ticket: DesktopTicket) {
    const { userId, sessionId, host, port } = ticket;
    this.sockets.add(client);
    // 주소·계정은 브라우저 입력이 아니라 저장 시 검증한 대상 값만 씀.
    const target =
      ticket.protocol === 'rdp'
        ? createConnection(this.guacd())
        : createConnection({ host, port });
    // RDP 는 명령 단위로 직접 중계하므로 바이트 스트림을 만들지 않음.
    const stream =
      ticket.protocol === 'vnc' ? createWebSocketStream(client) : undefined;
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      clearTimeout(connectionTimeout);
      clearTimeout(lifetime);
      clearInterval(check);
      clearInterval(heartbeat);
      unbindSession();
      if (stream) target.unpipe(stream);
      stream?.unpipe(target);
      target.removeAllListeners('data');
      client.removeAllListeners('message');
      target.destroy();
      stream?.destroy();
      client.terminate();
      this.sockets.delete(client);
      this.cleanup.delete(client);
      this.logger.log({ event: 'remote-desktop.disconnected', userId });
    };
    const unbindSession = this.sessionConnections.bind(sessionId, close);
    const connectionTimeout = setTimeout(close, 10_000);
    const lifetime = setTimeout(close, 15 * 60_000);
    let checking = false;
    const check = setInterval(() => {
      if (closed || checking) return;
      checking = true;
      void Promise.all([
        this.users.findByIdWithRoles(userId),
        this.sessionVerifier.isActive(sessionId),
      ])
        .then(([user, sessionActive]) => {
          if (!sessionActive || !user || !isGlobalAdministrator(user.roles))
            close();
        })
        .catch(close)
        .finally(() => {
          checking = false;
        });
    }, 30_000);
    // 정상 종료 프레임 없이 망이 끊겨도 다음 두 번의 확인 안에 정리함.
    let alive = true;
    const heartbeat = setInterval(() => {
      if (!alive) return close();
      alive = false;
      client.ping();
    }, 30_000);
    client.on('pong', () => {
      alive = true;
    });
    this.cleanup.set(client, close);
    target.once('connect', () => {
      if (closed) return;
      if (ticket.protocol === 'rdp') {
        this.bridgeGuacamole(
          client,
          target,
          ticket,
          () => {
            clearTimeout(connectionTimeout);
            this.logger.log({ event: 'remote-desktop.connected', userId });
          },
          close,
        );
        return;
      }
      clearTimeout(connectionTimeout);
      if (stream) target.pipe(stream).pipe(target);
      this.logger.log({ event: 'remote-desktop.connected', userId });
    });
    target.on('error', close);
    target.on('close', close);
    stream?.on('error', close);
    stream?.once('close', close);
    client.on('error', close);
    client.once('close', close);
  }

  // guacd 와 핸드셰이크를 마친 뒤 명령 단위로 중계함. 브라우저가 보내는 내부 명령(opcode "")은 guacd 로 넘기지 않음.
  private bridgeGuacamole(
    client: WebSocket,
    target: Socket,
    ticket: DesktopTicket,
    ready: () => void,
    close: () => void,
  ) {
    const decoder = new StringDecoder('utf8');
    const reader = new InstructionReader();
    let connected = false;
    target.write(encodeInstruction('select', 'rdp'));
    target.on('data', (chunk: Buffer) => {
      let instructions;
      try {
        instructions = reader.push(decoder.write(chunk));
      } catch {
        return close();
      }
      if (!connected) {
        const index = instructions.findIndex(
          (item) => item.opcode === 'args' || item.opcode === 'ready',
        );
        if (index === -1) return;
        const first = instructions[index];
        if (first.opcode === 'args') {
          target.write(
            rdpHandshake(first.args, {
              hostname: ticket.host,
              port: ticket.port,
              ...ticket.credentials,
            }),
          );
          instructions = instructions.slice(index + 1);
          const ready = instructions.findIndex(
            (item) => item.opcode === 'ready',
          );
          if (ready === -1) return;
          instructions = instructions.slice(ready);
        }
        connected = true;
        ready();
        // 브라우저 터널은 첫 내부 명령의 값을 연결 ID로 씀.
        client.send(encodeInstruction('', instructions[0].args[0] ?? ''));
        instructions = instructions.slice(1);
      }
      if (instructions.length)
        client.send(instructions.map((item) => item.raw).join(''));
    });
    client.on('message', (data, binary) => {
      if (binary) return close();
      const text = Buffer.isBuffer(data)
        ? data.toString('utf8')
        : Buffer.concat(data as Buffer[]).toString('utf8');
      if (text.startsWith('0.,')) {
        // 터널 안정성 확인용 ping 은 그대로 돌려보냄.
        if (text.startsWith('0.,4.ping,')) client.send(text);
        return;
      }
      if (connected) target.write(text);
    });
  }

  onModuleDestroy() {
    this.stopping = true;
    this.server?.off('upgrade', this.upgrade);
    for (const socket of this.pending) socket.destroy();
    this.pending.clear();
    for (const close of this.cleanup.values()) close();
    this.ws.close();
    this.tickets.clear();
  }
}
