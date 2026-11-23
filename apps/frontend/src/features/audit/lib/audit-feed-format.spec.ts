import { describe, expect, it } from 'vitest';
import {
  formatDayHeading,
  formatFeedTime,
  groupFeedByDay,
  periodStart,
} from './audit-feed-format';
import type { AuditFeedItem } from '../model/audit.types';

const now = new Date(2026, 10, 23, 15, 0, 0);

function item(createdAt: Date): AuditFeedItem {
  return {
    event: {
      id: createdAt.toISOString(),
      domain: 'security',
      action: 'login.success',
      summary: '로그인',
      actorId: 'u',
      actorEmail: 'admin@example.com',
      targetType: null,
      targetId: null,
      metadata: {},
      createdAt: createdAt.toISOString(),
    },
    kind: 'human',
    attention: false,
    count: 1,
    firstAt: createdAt.toISOString(),
  };
}

describe('감사 목록 표시 형식', () => {
  it('가까운 시각은 몇 분 전으로 쓴다', () => {
    expect(
      formatFeedTime(new Date(2026, 10, 23, 14, 55).toISOString(), now),
    ).toBe('5분 전');
    expect(
      formatFeedTime(new Date(2026, 10, 23, 14, 59, 30).toISOString(), now),
    ).toBe('방금');
  });

  it('날짜 제목은 오늘·어제를 먼저 쓴다', () => {
    expect(formatDayHeading(new Date(2026, 10, 23, 1).toISOString(), now)).toBe(
      '오늘',
    );
    expect(
      formatDayHeading(new Date(2026, 10, 22, 23).toISOString(), now),
    ).toBe('어제');
  });

  it('최신순 목록을 날짜별로 나눈다', () => {
    const days = groupFeedByDay(
      [
        item(new Date(2026, 10, 23, 10)),
        item(new Date(2026, 10, 23, 9)),
        item(new Date(2026, 10, 22, 20)),
      ],
      now,
    );
    expect(days.map((day) => [day.heading, day.items.length])).toEqual([
      ['오늘', 2],
      ['어제', 1],
    ]);
  });

  it('오늘 기간은 자정부터 센다', () => {
    expect(periodStart('today', now)).toBe(
      new Date(2026, 10, 23).toISOString(),
    );
    expect(periodStart('all', now)).toBeUndefined();
  });
});
