import { describe, expect, it } from 'vitest';
import { GetAuditFeedUseCase } from '@/audit/application/use-cases/get-audit-feed.use-case';
import type { IAuditLogRepository } from '@/audit/domain/repositories/audit-log.repository.interface';
import type { AuditEvent } from '@/audit/domain/types/audit-event.type';

function event(id: string, overrides: Partial<AuditEvent>): AuditEvent {
  return {
    id,
    domain: 'repository',
    action: 'upload.batch.complete',
    summary: id,
    actorId: 'user-1',
    actorEmail: 'admin@example.com',
    targetType: 'project',
    targetId: 'p1',
    metadata: {},
    createdAt: '2026-11-23T06:00:00.000Z',
    ...overrides,
  };
}

const events = [
  event('reveal', {
    domain: 'secrets',
    action: 'secret.reveal',
    createdAt: '2026-11-23T06:10:00.000Z',
  }),
  event('up-1', { createdAt: '2026-11-23T06:05:00.000Z' }),
  event('up-2', { createdAt: '2026-11-23T06:04:00.000Z' }),
  event('block', {
    domain: 'security',
    action: 'ssh.country-block',
    actorId: null,
    actorEmail: null,
    createdAt: '2026-11-23T06:03:00.000Z',
  }),
];

function useCase() {
  const repository = {
    export: async () => ({ items: events }),
  } as unknown as IAuditLogRepository;
  return new GetAuditFeedUseCase(repository);
}

describe('GetAuditFeedUseCase', () => {
  it('탭 숫자는 묶기 전 기록 수로 센다', async () => {
    const feed = await useCase().execute({});
    expect(feed.counts).toEqual({ all: 4, attention: 1, human: 3, system: 1 });
  });

  it('반복 업로드는 한 줄로 묶어 개수를 함께 준다', async () => {
    const feed = await useCase().execute({ view: 'human' });
    expect(feed.items.map((item) => [item.event.id, item.count])).toEqual([
      ['reveal', 1],
      ['up-1', 2],
    ]);
    expect(feed.items[0].attention).toBe(true);
  });

  it('자동 보기에는 사람이 한 일을 넣지 않는다', async () => {
    const feed = await useCase().execute({ view: 'system' });
    expect(feed.items.map((item) => item.event.id)).toEqual(['block']);
    expect(feed.items[0].kind).toBe('system');
  });

  it('보여 줄 줄 수를 넘으면 더 있음을 알린다', async () => {
    const feed = await useCase().execute({ limit: 1 });
    expect(feed.items).toHaveLength(1);
    expect(feed.hasMore).toBe(true);
  });
});
