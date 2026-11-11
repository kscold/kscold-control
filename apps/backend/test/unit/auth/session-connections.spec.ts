import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { once } from 'node:events';
import { Server } from 'socket.io';
import { io, type Socket as ClientSocket } from 'socket.io-client';
import { SESSION_RECHECK_INTERVAL_MS } from '@/auth/application/services/session-connection-registry.service';
import { browser, sessionHarness } from './auth-session.fake';

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

/** 게이트웨이처럼 핸드셰이크의 세션 id 로 소켓을 묶는 실제 socket.io 서버 */
async function socketServer(harness: ReturnType<typeof sessionHarness>) {
  const http: HttpServer = createServer();
  const server = new Server(http);
  server.on('connection', (socket) => {
    harness.connections.bindSocket(String(socket.handshake.auth.sid), socket);
    socket.emit('ready');
  });
  http.listen(0, '127.0.0.1');
  await once(http, 'listening');
  const url = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
  const clients: ClientSocket[] = [];

  async function connect(sid: string) {
    const client = io(url, {
      auth: { sid },
      transports: ['websocket'],
      reconnection: false,
    });
    clients.push(client);
    await new Promise((resolve) => client.once('ready', resolve));
    return client;
  }

  async function close() {
    clients.forEach((client) => client.close());
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  return { connect, close };
}

function disconnectReason(client: ClientSocket): Promise<string> {
  return new Promise((resolve) => client.once('disconnect', resolve));
}

describe('세션에 묶인 연결', () => {
  let harness: ReturnType<typeof sessionHarness>;
  let server: Awaited<ReturnType<typeof socketServer>>;

  beforeEach(async () => {
    harness = sessionHarness();
    server = await socketServer(harness);
  });

  afterEach(async () => {
    harness.connections.onModuleDestroy();
    await server.close();
    jest.useRealTimers();
  });

  it('로그아웃하면 그 세션의 소켓만 서버가 끊는다', async () => {
    const mine = await harness.sessions.open('user-1', browser);
    const other = await harness.sessions.open('user-1', browser);
    const tab1 = await server.connect(mine.id);
    const tab2 = await server.connect(mine.id);
    const otherBrowser = await server.connect(other.id);
    const reasons = Promise.all([
      disconnectReason(tab1),
      disconnectReason(tab2),
    ]);

    await harness.sessions.revoke(mine.id);

    await expect(reasons).resolves.toEqual([
      'io server disconnect',
      'io server disconnect',
    ]);
    expect(otherBrowser.connected).toBe(true);
  });

  it('관리자 세션을 끊으면 그 세션이 연 미리보기 세션의 연결도 끊긴다', async () => {
    const admin = await harness.sessions.open('admin-1', browser);
    const preview = await harness.sessions.open('user-2', browser, {
      parentSessionId: admin.id,
      absoluteTtlMs: 15 * MINUTE,
    });
    const client = await server.connect(preview.id);
    const reason = disconnectReason(client);

    await harness.sessions.revoke(admin.id);

    await expect(reason).resolves.toBe('io server disconnect');
  });

  it('본인이 다른 세션을 모두 끊으면 지금 세션과 그 미리보기만 남는다', async () => {
    const current = await harness.sessions.open('user-1', browser);
    const preview = await harness.sessions.open('user-2', browser, {
      parentSessionId: current.id,
      absoluteTtlMs: 15 * MINUTE,
    });
    const stolen = await harness.sessions.open('user-1', browser);
    const someoneElse = await harness.sessions.open('user-3', browser);
    const currentTab = await server.connect(current.id);
    const previewTab = await server.connect(preview.id);
    const stolenTab = await server.connect(stolen.id);
    const otherUserTab = await server.connect(someoneElse.id);
    const reason = disconnectReason(stolenTab);

    const revoked = await harness.sessions.revokeAllForUser('user-1', {
      id: 'user-1',
      sessionId: current.id,
    });

    expect(revoked).toBe(1);
    await expect(reason).resolves.toBe('io server disconnect');
    expect(currentTab.connected).toBe(true);
    expect(previewTab.connected).toBe(true);
    expect(otherUserTab.connected).toBe(true);
    await expect(harness.verifier.isActive(stolen.id)).resolves.toBe(false);
  });

  it('관리자가 다른 사용자의 세션을 끊으면 그 사용자의 세션은 하나도 남지 않는다', async () => {
    const first = await harness.sessions.open('user-1', browser);
    const second = await harness.sessions.open('user-1', browser);
    const tabs = [
      await server.connect(first.id),
      await server.connect(second.id),
    ];
    const reasons = Promise.all(tabs.map(disconnectReason));

    const revoked = await harness.sessions.revokeAllForUser('user-1', {
      id: 'admin-1',
      sessionId: '00000000-0000-4000-8000-0000000000ff',
    });

    expect(revoked).toBe(2);
    await expect(reasons).resolves.toEqual([
      'io server disconnect',
      'io server disconnect',
    ]);
  });

  it('DB 에서 직접 끊긴 세션의 소켓은 다음 재확인 주기 안에 끊긴다', async () => {
    const outOfBand = await harness.sessions.open('user-1', browser);
    const alive = await harness.sessions.open('user-1', browser);
    const revokedTab = await server.connect(outOfBand.id);
    const aliveTab = await server.connect(alive.id);
    jest.useFakeTimers({
      doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'],
    });
    harness.connections.onModuleInit();
    harness.repository.rows.set(outOfBand.id, {
      ...harness.repository.rows.get(outOfBand.id)!,
      revokedAt: new Date(),
    });
    const reason = disconnectReason(revokedTab);

    await jest.advanceTimersByTimeAsync(SESSION_RECHECK_INTERVAL_MS - 1);
    expect(revokedTab.connected).toBe(true);
    await jest.advanceTimersByTimeAsync(1);

    jest.useRealTimers();
    await expect(reason).resolves.toBe('io server disconnect');
    expect(aliveTab.connected).toBe(true);
  });

  it('만료된 세션의 연결은 재확인 때 닫는다', async () => {
    jest.useFakeTimers({
      now: new Date('2026-01-01T00:00:00.000Z'),
      doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'],
    });
    const session = await harness.sessions.open('user-1', browser);
    const close = jest.fn();
    harness.connections.bind(session.id, close);

    jest.setSystemTime(Date.now() + 7 * DAY - MINUTE);
    await harness.connections.recheck();
    expect(close).not.toHaveBeenCalled();

    jest.setSystemTime(Date.now() + MINUTE);
    await harness.connections.recheck();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('세션 저장소에 닿지 못하면 연결을 끊지 않고 다음 차례에 다시 본다', async () => {
    const session = await harness.sessions.open('user-1', browser);
    const close = jest.fn();
    harness.connections.bind(session.id, close);
    const findById = jest
      .spyOn(harness.repository, 'findById')
      .mockRejectedValueOnce(new Error('connection refused'));

    await harness.connections.recheck();
    expect(close).not.toHaveBeenCalled();

    harness.repository.rows.set(session.id, {
      ...harness.repository.rows.get(session.id)!,
      revokedAt: new Date(),
    });
    await harness.connections.recheck();
    expect(close).toHaveBeenCalledTimes(1);
    findById.mockRestore();
  });

  it('먼저 닫힌 연결은 세션이 끊길 때 다시 닫지 않는다', async () => {
    const session = await harness.sessions.open('user-1', browser);
    const closedEarly = jest.fn();
    const stillOpen = jest.fn();
    const unbind = harness.connections.bind(session.id, closedEarly);
    harness.connections.bind(session.id, stillOpen);

    unbind();
    await harness.sessions.revoke(session.id);

    expect(closedEarly).not.toHaveBeenCalled();
    expect(stillOpen).toHaveBeenCalledTimes(1);
  });
});
