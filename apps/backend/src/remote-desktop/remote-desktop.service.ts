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
import { createConnection } from 'node:net';
import type { Server, IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, WebSocket, createWebSocketStream } from 'ws';
import {
  USER_REPOSITORY,
  IUserRepository,
} from '../rbac/domain/repositories/user.repository.interface';
import type { JwtPayload } from '../common/types/jwt-request.type';
import { isGlobalAdministrator } from '../common/utils/role-access.util';
import type { DesktopConnection } from './remote-desktop-targets.service';

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
  private readonly tickets = new Map<
    string,
    { userId: string; expires: number; port: number }
  >();
  private readonly sockets = new Set<WebSocket>();
  private server?: Server;
  private readonly ws = new WebSocketServer({
    noServer: true,
    maxPayload: 1024 * 1024,
    perMessageDeflate: false,
    handleProtocols: () => 'binary',
  });

  constructor(
    private readonly adapter: HttpAdapterHost,
    private readonly config: ConfigService,
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
  ) {}

  issue(user: JwtPayload, connection?: DesktopConnection) {
    if (!canControlDesktop(user))
      throw new ForbiddenException(
        '관리자 본인 계정으로만 원격 접속할 수 있습니다.',
      );
    const settings = this.settings();
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
      expires: now + 30_000,
      port: connection?.port ?? settings.port,
    });
    return {
      ticket,
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
    if (request.url?.split('?')[0] !== '/api/remote-desktop/socket') return;
    void this.accept(request, socket, head).catch(() => {
      if (!socket.destroyed)
        socket.end(
          'HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n',
        );
    });
  };

  private async accept(request: IncomingMessage, socket: Duplex, head: Buffer) {
    const { origin } = this.settings();
    if (
      request.url !== '/api/remote-desktop/socket' ||
      request.headers.origin !== origin ||
      this.sockets.size >= 3
    )
      throw new Error('Rejected');
    const protocols = (request.headers['sec-websocket-protocol'] || '')
      .split(',')
      .map((value) => value.trim());
    const key = protocols
      .find((value) => /^ticket\.[a-f0-9]{64}$/.test(value))
      ?.slice(7);
    const ticket = key ? this.tickets.get(key) : undefined;
    if (key) this.tickets.delete(key);
    if (
      !ticket ||
      ticket.expires <= Date.now() ||
      !protocols.includes('binary')
    )
      throw new Error('Rejected');
    const user = await this.users.findByIdWithRoles(ticket.userId);
    if (
      !user ||
      !isGlobalAdministrator(user.roles) ||
      socket.destroyed ||
      this.sockets.size >= 3
    )
      throw new Error('Rejected');
    this.ws.handleUpgrade(request, socket, head, (client) =>
      this.connect(client, ticket.userId, ticket.port),
    );
  }

  private connect(client: WebSocket, userId: string, port: number) {
    this.sockets.add(client);
    // 브라우저가 지정한 호스트로 접속하지 않는다. 원격 호스트는 별도 SSH 로컬 터널을 사용한다.
    const target = createConnection({ host: '127.0.0.1', port });
    const stream = createWebSocketStream(client);
    const close = () => {
      target.destroy();
      stream.destroy();
      client.terminate();
    };
    const connectionTimeout = setTimeout(close, 10_000);
    const lifetime = setTimeout(close, 15 * 60_000);
    let checking = false;
    const check = setInterval(() => {
      if (checking) return;
      checking = true;
      void this.users
        .findByIdWithRoles(userId)
        .then((user) => {
          if (!user || !isGlobalAdministrator(user.roles)) close();
        })
        .catch(close)
        .finally(() => {
          checking = false;
        });
    }, 30_000);
    target.once('connect', () => {
      clearTimeout(connectionTimeout);
      target.pipe(stream).pipe(target);
      this.logger.log({ event: 'remote-desktop.connected', userId });
    });
    target.on('error', close);
    target.on('close', close);
    stream.on('error', close);
    client.once('close', () => {
      clearTimeout(connectionTimeout);
      clearTimeout(lifetime);
      clearInterval(check);
      target.destroy();
      stream.destroy();
      this.sockets.delete(client);
      this.logger.log({ event: 'remote-desktop.disconnected', userId });
    });
  }

  onModuleDestroy() {
    this.server?.off('upgrade', this.upgrade);
    for (const socket of this.sockets) socket.terminate();
    this.ws.close();
    this.tickets.clear();
  }
}
