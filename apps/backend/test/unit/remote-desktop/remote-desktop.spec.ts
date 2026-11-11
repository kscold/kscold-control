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
import { SessionVerifier } from '../../../src/auth/application/services/session-verifier.service';
import { SessionConnectionRegistry } from '../../../src/auth/application/services/session-connection-registry.service';
import { browser, sessionHarness } from '../auth/auth-session.fake';

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
    sessionId: '',
    sessionAssurance: 'mfa' as const,
  };
  const users = { findByIdWithRoles: jest.fn() };
  let auth: ReturnType<typeof sessionHarness>;

  beforeEach(async () => {
    auth = sessionHarness();
    administrator.sessionId = (
      await auth.sessions.open(administrator.id, browser)
    ).id;
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
        { provide: SessionVerifier, useValue: auth.verifier },
        { provide: SessionConnectionRegistry, useValue: auth.connections },
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

  it('대상에 저장된 주소로 연결하고 없으면 서버 자신으로 연결한다', async () => {
    // 기본값(127.0.0.1)으로는 닿지 않는 주소에서만 듣게 해서 대상 주소를 쓰는지 확인함.
    const other = createTcpServer((socket) => socket.pipe(socket));
    other.listen(0, '::1');
    await once(other, 'listening');
    const incoming = once(other, 'connection');
    const { ticket } = service.issue(administrator, {
      id: 'second',
      host: '::1',
      protocol: 'vnc',
      port: (other.address() as AddressInfo).port,
    });
    const client = connect(ticket);
    await once(client, 'open');
    const [target] = await incoming;
    const closed = once(target, 'close');
    client.close();
    await closed;
    await new Promise<void>((resolve) => other.close(() => resolve()));
  });

  describe('RDP(guacd 중계)', () => {
    const rdpTarget = {
      id: 'windows',
      host: '10.0.0.5',
      port: 3389,
      protocol: 'rdp' as const,
      credentials: { username: 'tester', password: 'not-a-real-password' },
    };
    let guacd: ReturnType<typeof createTcpServer>;
    let received = '';

    beforeEach(async () => {
      received = '';
      guacd = createTcpServer((socket) => {
        socket.on('data', (chunk) => {
          received += chunk.toString();
          if (received === '6.select,3.rdp;')
            socket.write(
              '4.args,13.VERSION_1_5_0,8.hostname,4.port,8.username,8.password,8.security;',
            );
          else if (received.includes('7.connect,'))
            socket.write('5.ready,5.$abcd;4.sync,1.1;');
        });
      });
      guacd.listen(0, '127.0.0.1');
      await once(guacd, 'listening');
      config.set('GUACD_HOST', '127.0.0.1');
      config.set('GUACD_PORT', String((guacd.address() as AddressInfo).port));
    });

    afterEach(async () => {
      await new Promise<void>((resolve) => guacd.close(() => resolve()));
    });

    function guac(ticket: string) {
      return new WebSocket(
        url.replace('/socket', `/guac?ticket=${ticket}`),
        'guacamole',
        { origin: 'https://control.example.com' },
      );
    }

    it('guacd 가 없으면 RDP 표를 발급하지 않는다', () => {
      config.set('GUACD_HOST', '');
      expect(() => service.issue(administrator, rdpTarget)).toThrow('guacd');
    });

    it('RDP 계정은 브라우저로 보내지 않고 guacd 에만 넘긴다', async () => {
      const issued = service.issue(administrator, rdpTarget);
      expect(JSON.stringify(issued)).not.toContain('not-a-real-password');
      const client = guac(issued.ticket);
      const messages: string[] = [];
      client.on('message', (data) => messages.push(data.toString()));
      await once(client, 'open');
      await new Promise<void>((resolve) => {
        const timer = setInterval(() => {
          if (messages.length >= 2) {
            clearInterval(timer);
            resolve();
          }
        }, 5);
      });
      expect(messages).toEqual(['0.,5.$abcd;', '4.sync,1.1;']);
      expect(received).toContain(
        '7.connect,13.VERSION_1_5_0,8.10.0.0.5,4.3389,6.tester,19.not-a-real-password,3.any;',
      );
      client.send('0.,4.ping,3.123;');
      const [pong] = await once(client, 'message');
      expect(pong.toString()).toBe('0.,4.ping,3.123;');
      expect(received).not.toContain('ping');
      client.close();
    });

    it('VNC 표로 RDP 경로에 붙거나 RDP 표로 VNC 경로에 붙을 수 없다', async () => {
      const vnc = guac(service.issue(administrator).ticket);
      await once(vnc, 'error');
      const rdp = connect(service.issue(administrator, rdpTarget).ticket);
      await once(rdp, 'error');
      expect(received).toBe('');
    });
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
      service.issue(administrator, { id: 'local', port: 5900, protocol: 'vnc' })
        .suggestedUsername,
    ).toBe('default-user');
    expect(
      service.issue(administrator, { id: 'other', port: 5901, protocol: 'vnc' })
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

  it('로그아웃 전에 받은 연결권은 로그아웃 뒤 거부한다', async () => {
    const { ticket } = service.issue(administrator);
    await auth.sessions.revoke(administrator.sessionId);

    const client = connect(ticket);
    const [error] = await once(client, 'error');
    expect(error.message).toContain('403');
  });

  it('세션을 끊으면 열린 원격 화면과 TCP 연결을 바로 닫는다', async () => {
    const { client, target } = await session();
    const closed = once(target, 'close');
    const clientClosed = once(client, 'close');

    await auth.sessions.revoke(administrator.sessionId);

    await Promise.all([closed, clientClosed]);
  });

  it('DB 에서 끊기거나 만료된 세션은 다음 주기 확인에서 닫는다', async () => {
    const intervals = jest.spyOn(global, 'setInterval');
    const { client, target } = await session();
    const liveness = intervals.mock.calls[0][0];
    const row = auth.repository.rows.get(administrator.sessionId)!;
    auth.repository.rows.set(row.id, { ...row, revokedAt: new Date() });
    const closed = once(target, 'close');
    const clientClosed = once(client, 'close');

    if (typeof liveness === 'function') liveness();

    await Promise.all([closed, clientClosed]);
  });
});
