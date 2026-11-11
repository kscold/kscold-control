import { IpAllowlistService } from '@/security/application/services/ip-allowlist.service';
import { CreateIpBanUseCase } from '@/security/application/use-cases/create-ip-ban.use-case';
import {
  BATCHED_RESYNC_DELAY_MS,
  ResyncBlocklistUseCase,
} from '@/security/application/use-cases/resync-blocklist.use-case';
import type { INginxBlocklistWriter } from '@/security/domain/repositories/nginx-blocklist.writer';
import { InMemoryIpBanRepository } from './login-guard.fake';

/** nginx 에 반영하려던 목록을 남기고, release 를 부를 때까지 반영을 붙잡아 둘 수 있다. */
class GatedBlocklistWriter implements INginxBlocklistWriter {
  readonly applied: string[][] = [];
  private gate: Promise<void> | null = null;
  release = () => undefined as void;

  hold() {
    this.gate = new Promise((resolve) => {
      this.release = () => {
        this.gate = null;
        resolve();
      };
    });
  }

  async apply(ips: string[]) {
    const snapshot = [...ips];
    await this.gate;
    this.applied.push(snapshot);
    return { reloaded: true, output: 'test' };
  }
}

function setup() {
  const ipBans = new InMemoryIpBanRepository();
  const nginx = new GatedBlocklistWriter();
  const resync = new ResyncBlocklistUseCase(ipBans, nginx);
  const create = new CreateIpBanUseCase(
    ipBans,
    new IpAllowlistService(),
    resync,
  );
  const ban = (ip: string, deferResync = false) =>
    create.execute({
      ip,
      reason: null,
      ttlMinutes: 60,
      source: 'auto-login',
      createdBy: null,
      requesterIp: null,
      deferResync,
    });
  return { nginx, resync, ban };
}

describe('ResyncBlocklistUseCase', () => {
  afterEach(() => jest.useRealTimers());

  it('2초 사이에 몰린 자동 차단 5건은 모아서 nginx 에 한 번 반영한다', async () => {
    jest.useFakeTimers();
    const { nginx, resync, ban } = setup();
    const ips = [
      '203.0.113.1',
      '203.0.113.2',
      '203.0.113.3',
      '203.0.113.4',
      '203.0.113.5',
    ];

    for (const ip of ips) {
      await ban(ip, true);
      await jest.advanceTimersByTimeAsync(400);
    }
    expect(nginx.applied).toEqual([]);

    await jest.advanceTimersByTimeAsync(BATCHED_RESYNC_DELAY_MS);
    expect(nginx.applied).toHaveLength(1);
    expect([...nginx.applied[0]].sort()).toEqual(ips);

    await ban('203.0.113.6', true);
    await jest.advanceTimersByTimeAsync(BATCHED_RESYNC_DELAY_MS);
    expect(nginx.applied).toHaveLength(2);
    resync.onModuleDestroy();
  });

  it('반영 중에 들어온 요청들은 끝난 뒤 한 번만 더 반영해 그사이 추가된 차단을 빠뜨리지 않는다', async () => {
    const { nginx, resync, ban } = setup();
    await ban('203.0.113.10');
    nginx.hold();

    const first = resync.execute();
    await ban('203.0.113.11', true);
    const [second, third] = [resync.execute(), resync.execute()];
    nginx.release();
    await Promise.all([first, second, third]);

    expect(nginx.applied.map((ips) => [...ips].sort())).toEqual([
      ['203.0.113.10'],
      ['203.0.113.10'],
      ['203.0.113.10', '203.0.113.11'],
    ]);
    resync.onModuleDestroy();
  });
});
