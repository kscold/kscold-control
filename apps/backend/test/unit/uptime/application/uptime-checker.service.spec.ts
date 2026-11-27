import { UptimeCheckerService } from '@/uptime/application/services/uptime-checker.service';
import type { ServiceMonitor } from '@/uptime/domain/entities/service-monitor.entity';

function setup(results: { ok: boolean }[]) {
  const checks: { ok: boolean; latencyMs: number | null }[] = [];
  const monitor = {
    id: 'm1',
    name: 'blog',
    url: 'https://example.com',
    intervalSeconds: 60,
    enabled: true,
    state: 'up',
    stateChangedAt: null,
    lastCheckedAt: null,
  } as unknown as ServiceMonitor;
  const repo = {
    list: vi.fn().mockResolvedValue([monitor]),
    addCheck: vi.fn(async (c) => void checks.unshift(c)),
    recentChecks: vi.fn(async (_id, _since, limit) => checks.slice(0, limit)),
    save: vi.fn(async (m) => m),
    pruneChecks: vi.fn(),
  };
  const probe = {
    probe: vi.fn(async () => {
      const next = results.shift() ?? { ok: true };
      return {
        ok: next.ok,
        statusCode: next.ok ? 200 : 502,
        latencyMs: next.ok ? 50 : null,
        error: next.ok ? null : 'HTTP 502',
      };
    }),
  };
  const notifier = { notify: vi.fn() };
  const service = new UptimeCheckerService(
    repo as never,
    probe as never,
    notifier as never,
  );
  return { service, monitor, notifier };
}

describe('UptimeCheckerService', () => {
  it('두 번 연속 실패하면 down 으로 바꾸고 한 번만 알린다', async () => {
    const { service, monitor, notifier } = setup([
      { ok: false },
      { ok: false },
      { ok: false },
    ]);
    await service.check(monitor);
    expect(monitor.state).toBe('up');
    await service.check(monitor);
    expect(monitor.state).toBe('down');
    await service.check(monitor);
    expect(notifier.notify).toHaveBeenCalledTimes(1);
    expect(notifier.notify).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'down', detail: 'HTTP 502' }),
    );
  });

  it('down 에서 성공하면 복구 알림을 보낸다', async () => {
    const { service, monitor, notifier } = setup([{ ok: true }]);
    monitor.state = 'down';
    await service.check(monitor);
    expect(monitor.state).toBe('up');
    expect(notifier.notify).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'up' }),
    );
  });

  it('아직 때가 안 된 대상은 검사하지 않는다', async () => {
    const { service, monitor } = setup([]);
    const now = new Date();
    monitor.lastCheckedAt = new Date(now.getTime() - 10_000);
    const spy = vi.spyOn(service, 'check');
    await service.tick(now);
    expect(spy).not.toHaveBeenCalled();
  });
});
