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
  });

  function connect(ticket: string, origin = 'https://control.example.com') {
    return new WebSocket(url, ['binary', `ticket.${ticket}`], { origin });
  }

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
