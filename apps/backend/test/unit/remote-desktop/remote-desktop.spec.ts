import { Test } from '@nestjs/testing';
import { HttpAdapterHost } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { createServer as createHttpServer, Server } from 'node:http';
import { createServer as createTcpServer } from 'node:net';
import { AddressInfo } from 'node:net';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import {
  RemoteDesktopService,
  canControlDesktop,
} from '../../../src/remote-desktop/remote-desktop.service';
import { USER_REPOSITORY } from '../../../src/rbac/domain/repositories/user.repository.interface';

describe('원격 데스크톱 보안 중계', () => {
  let http: Server;
  let tcp: ReturnType<typeof createTcpServer>;
  let service: RemoteDesktopService;
  let url: string;
  let config: ConfigService;
  const administrator = {
    id: 'admin-id',
    email: 'admin@example.com',
    roles: ['admin'],
    permissions: [],
    sessionId: 'admin-session',
  };
  const users = { findByIdWithRoles: jest.fn() };

  beforeEach(async () => {
    http = createHttpServer();
    tcp = createTcpServer((socket) => socket.pipe(socket));
    tcp.listen(0, '127.0.0.1');
    await once(tcp, 'listening');
    const address = tcp.address() as AddressInfo;
    config = new ConfigService({
      REMOTE_DESKTOP_ENABLED: 'true',
      REMOTE_DESKTOP_ORIGIN: 'https://control.example.com',
      REMOTE_DESKTOP_PORT: String(address.port),
    });
    users.findByIdWithRoles.mockResolvedValue(administrator);
    const module = await Test.createTestingModule({
      providers: [
        RemoteDesktopService,
        {
          provide: HttpAdapterHost,
          useValue: { httpAdapter: { getHttpServer: () => http } },
        },
        { provide: ConfigService, useValue: config },
        { provide: USER_REPOSITORY, useValue: users },
      ],
    }).compile();
    service = module.get(RemoteDesktopService);
    service.onApplicationBootstrap();
    http.listen(0, '127.0.0.1');
    await once(http, 'listening');
    url = `ws://127.0.0.1:${(http.address() as AddressInfo).port}/api/remote-desktop/socket`;
  });

  afterEach(async () => {
    service.onModuleDestroy();
    await Promise.all([
      new Promise<void>((resolve) => http.close(() => resolve())),
      new Promise<void>((resolve) => tcp.close(() => resolve())),
    ]);
    jest.restoreAllMocks();
  });

  function connect(ticket: string, origin = 'https://control.example.com') {
    return new WebSocket(url, ['binary', `ticket.${ticket}`], { origin });
  }

  async function session(autoPong = true) {
    const incoming = once(tcp, 'connection');
    const client = new WebSocket(
      url,
      ['binary', `ticket.${service.issue(administrator).ticket}`],
      {
        origin: 'https://control.example.com',
        autoPong,
      },
    );
    await once(client, 'open');
    const [target] = await incoming;
    return { client, target };
  }

  it('반복 연결 종료와 강제 단절 시 TCP와 세션 타이머를 모두 해제한다', async () => {
    const intervals = jest.spyOn(global, 'setInterval');
    const clear = jest.spyOn(global, 'clearInterval');
    for (let index = 0; index < 6; index += 1) {
      const { client, target } = await session();
      const closed = once(target, 'close');
      const clientClosed = once(client, 'close');
      if (index % 2) client.terminate();
      else client.close();
      await Promise.all([closed, clientClosed]);
    }
    expect(intervals.mock.results).toHaveLength(12);
    for (const timer of intervals.mock.results)
      expect(clear).toHaveBeenCalledWith(timer.value);
    const count = await new Promise<number>((resolve, reject) =>
      tcp.getConnections((error, count) =>
        error ? reject(error) : resolve(count),
      ),
    );
    expect(count).toBe(0);
  });

  it('응답 없는 브라우저의 heartbeat 만료 시 양쪽 소켓을 해제한다', async () => {
    const intervals = jest.spyOn(global, 'setInterval');
    const { client, target } = await session(false);
    const heartbeat = intervals.mock.calls[1][0];
    expect(typeof heartbeat).toBe('function');
    const closed = once(target, 'close');
    const clientClosed = once(client, 'close');
    if (typeof heartbeat === 'function') {
      heartbeat();
      heartbeat();
    }
    await Promise.all([closed, clientClosed]);
  });

  it('원격 TCP 종료 시 브라우저 소켓도 종료한다', async () => {
    const { client, target } = await session();
    const closed = once(client, 'close');
    target.destroy();
    await closed;
  });

  it('서버 종료 시 활성 연결을 닫는다', async () => {
    const { client, target } = await session();
    const closed = once(target, 'close');
    const clientClosed = once(client, 'close');
    service.onModuleDestroy();
    await Promise.all([closed, clientClosed]);
  });

  it('서버 종료 뒤 늦은 인증 응답으로 새 TCP 연결을 만들지 않는다', async () => {
    let complete: ((user: typeof administrator) => void) | undefined;
    users.findByIdWithRoles.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const upgraded = once(http, 'upgrade');
    const client = connect(service.issue(administrator).ticket);
    const error = once(client, 'error');
    const opened = jest.fn();
    client.on('open', opened);
    await upgraded;
    service.onModuleDestroy();
    await error;
    complete?.(administrator);
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(opened).not.toHaveBeenCalled();
    const count = await new Promise<number>((resolve, reject) =>
      tcp.getConnections((error, count) =>
        error ? reject(error) : resolve(count),
      ),
    );
    expect(count).toBe(0);
  });

  it('관리자 이외의 계정과 사용자 미리보기를 차단한다', () => {
    expect(canControlDesktop({ roles: ['key_manager'] })).toBe(false);
    expect(
      canControlDesktop({
        roles: ['super_admin'],
        impersonation: {
          sessionId: 'qa',
          actorId: 'owner',
          actorEmail: 'owner@example.com',
          expiresAt: '',
          readOnly: true,
        },
      }),
    ).toBe(false);
    expect(() =>
      service.issue({ ...administrator, roles: ['terminal_only'] }),
    ).toThrow();
  });

  it('설정이 비활성화되면 연결권을 발급하지 않는다', () => {
    config.set('REMOTE_DESKTOP_ENABLED', 'false');
    expect(() => service.issue(administrator)).toThrow();
  });

  it('설치별 기본 계정은 기본 대상에만 전달한다', () => {
    config.set('REMOTE_DESKTOP_USERNAME', 'default-user');
    expect(service.issue(administrator).suggestedUsername).toBe('default-user');
    expect(
      service.issue(administrator, { id: 'local', port: 5900 })
        .suggestedUsername,
    ).toBe('default-user');
    expect(
      service.issue(administrator, { id: 'other', port: 5901 })
        .suggestedUsername,
    ).toBe('');
  });

  it('정상 연결에서 바이너리를 양방향 전달하고 연결권 재사용을 거부한다', async () => {
    const { ticket } = service.issue(administrator);
    const client = connect(ticket);
    await once(client, 'open');
    const received = once(client, 'message');
    client.send(Buffer.from([0, 255, 1, 2]));
    expect((await received)[0]).toEqual(Buffer.from([0, 255, 1, 2]));
    const duplicate = connect(ticket);
    const [error] = await once(duplicate, 'error');
    expect(error.message).toContain('403');
    client.close();
    await once(client, 'close');
  });

  it('다른 사이트에서 접속하면 거부한다', async () => {
    const client = connect(
      service.issue(administrator).ticket,
      'https://other.example.com',
    );
    const [error] = await once(client, 'error');
    expect(error.message).toContain('403');
  });

  it('연결 전에 관리자 권한이 회수되면 거부한다', async () => {
    const { ticket } = service.issue(administrator);
    users.findByIdWithRoles.mockResolvedValue({
      ...administrator,
      roles: ['guest'],
    });
    const client = connect(ticket);
    const [error] = await once(client, 'error');
    expect(error.message).toContain('403');
  });

  it('만료된 연결권은 거부한다', async () => {
    const now = Date.now();
    const clock = jest.spyOn(Date, 'now').mockReturnValue(now - 31_000);
    const { ticket } = service.issue(administrator);
    clock.mockRestore();
    const client = connect(ticket);
    const [error] = await once(client, 'error');
    expect(error.message).toContain('403');
  });
});
