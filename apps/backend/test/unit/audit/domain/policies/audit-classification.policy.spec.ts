import { describe, expect, it } from 'vitest';
import {
  auditActorKind,
  groupAuditEvents,
  needsAttention,
} from '@/audit/domain/policies/audit-classification.policy';
import type { AuditEvent } from '@/audit/domain/types/audit-event.type';

function event(overrides: Partial<AuditEvent>): AuditEvent {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    domain: 'repository',
    action: 'upload.batch.complete',
    summary: '업로드',
    actorId: 'user-1',
    actorEmail: 'admin@example.com',
    targetType: 'project',
    targetId: 'p1',
    metadata: {},
    createdAt: '2026-11-23T06:00:00.000Z',
    ...overrides,
  };
}

describe('auditActorKind', () => {
  it('사람 정보가 없으면 자동으로 된 일로 본다', () => {
    expect(auditActorKind({ actorId: null, actorEmail: null })).toBe('system');
    expect(auditActorKind({ actorId: 'u', actorEmail: null })).toBe('human');
  });
});

describe('needsAttention', () => {
  it('비밀값 열람과 사용자 삭제는 확인할 일로 분류한다', () => {
    expect(needsAttention({ domain: 'secrets', action: 'secret.reveal' })).toBe(
      true,
    );
    expect(needsAttention({ domain: 'rbac', action: 'user.delete' })).toBe(
      true,
    );
  });

  it('업로드나 로그인 성공은 확인할 일이 아니다', () => {
    expect(
      needsAttention({ domain: 'repository', action: 'upload.batch.complete' }),
    ).toBe(false);
    expect(
      needsAttention({ domain: 'security', action: 'login.success' }),
    ).toBe(false);
  });

  it('다른 도메인의 같은 이름 동작은 섞지 않는다', () => {
    expect(needsAttention({ domain: 'docker', action: 'secret.reveal' })).toBe(
      false,
    );
  });
});

describe('groupAuditEvents', () => {
  it('같은 사람이 같은 대상에 이어서 올린 업로드를 한 줄로 묶는다', () => {
    const groups = groupAuditEvents([
      event({ id: 'a', createdAt: '2026-11-23T06:09:00.000Z' }),
      event({ id: 'b', createdAt: '2026-11-23T06:05:00.000Z' }),
      event({ id: 'c', createdAt: '2026-11-23T06:01:00.000Z' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      count: 3,
      firstAt: '2026-11-23T06:01:00.000Z',
    });
    expect(groups[0].event.id).toBe('a');
  });

  it('간격이 10분을 넘거나 대상이 다르면 나눈다', () => {
    const groups = groupAuditEvents([
      event({ createdAt: '2026-11-23T07:00:00.000Z' }),
      event({ createdAt: '2026-11-23T06:30:00.000Z' }),
      event({ createdAt: '2026-11-23T06:29:00.000Z', targetId: 'p2' }),
    ]);
    expect(groups.map((group) => group.count)).toEqual([1, 1, 1]);
  });

  it('묶을 수 없는 동작은 반복돼도 한 줄씩 둔다', () => {
    const groups = groupAuditEvents([
      event({ domain: 'secrets', action: 'secret.reveal' }),
      event({ domain: 'secrets', action: 'secret.reveal' }),
    ]);
    expect(groups).toHaveLength(2);
  });
});
