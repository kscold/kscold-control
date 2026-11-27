import {
  clampHistoryHours,
  downsample,
} from '@/system/domain/policies/metric-history.policy';

describe('metric-history.policy', () => {
  it('시간 범위는 기본 24, 최대 72', () => {
    expect(clampHistoryHours(undefined)).toBe(24);
    expect(clampHistoryHours('6')).toBe(6);
    expect(clampHistoryHours('500')).toBe(72);
  });

  it('점이 많으면 구간 평균으로 줄이고 마지막 시각을 쓴다', () => {
    const base = Date.parse('2026-11-28T00:00:00Z');
    const samples = Array.from({ length: 4 }, (_, i) => ({
      at: new Date(base + i * 60_000),
      cpu: i * 10,
      memory: 50,
      disk: i === 0 ? null : 80,
    }));
    expect(downsample(samples, 2)).toEqual([
      { at: '2026-11-28T00:01:00.000Z', cpu: 5, memory: 50, disk: 80 },
      { at: '2026-11-28T00:03:00.000Z', cpu: 25, memory: 50, disk: 80 },
    ]);
  });
});
