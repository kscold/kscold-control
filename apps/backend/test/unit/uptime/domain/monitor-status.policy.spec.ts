import {
  isMonitorUrl,
  nextMonitorState,
  shouldNotify,
  summarizeChecks,
} from '@/uptime/domain/policies/monitor-status.policy';

const ok = { ok: true, latencyMs: 100 };
const fail = { ok: false, latencyMs: null };

describe('monitor-status.policy', () => {
  it('한 번 실패로는 down 이 아니고, 두 번 연속 실패면 down', () => {
    expect(nextMonitorState('up', [fail, ok])).toBe('up');
    expect(nextMonitorState('up', [fail, fail])).toBe('down');
  });

  it('성공 한 번이면 바로 up', () => {
    expect(nextMonitorState('down', [ok, fail])).toBe('up');
  });

  it('처음 up 은 알리지 않고, down 과 복구는 알린다', () => {
    expect(shouldNotify('unknown', 'up')).toBe(false);
    expect(shouldNotify('up', 'down')).toBe(true);
    expect(shouldNotify('down', 'up')).toBe(true);
    expect(shouldNotify('up', 'up')).toBe(false);
  });

  it('가동률과 성공한 검사의 평균 응답 시간을 낸다', () => {
    expect(
      summarizeChecks([ok, fail, { ok: true, latencyMs: 300 }, ok]),
    ).toEqual({
      uptimePercent: 75,
      averageLatencyMs: 167,
    });
    expect(summarizeChecks([])).toEqual({
      uptimePercent: null,
      averageLatencyMs: null,
    });
  });

  it('http·https 만 받고 아이디·비밀번호가 든 주소는 거절한다', () => {
    expect(isMonitorUrl('https://example.com/health')).toBe(true);
    expect(isMonitorUrl('ftp://example.com')).toBe(false);
    expect(isMonitorUrl('https://a:b@example.com')).toBe(false);
    expect(isMonitorUrl('example.com')).toBe(false);
  });
});
