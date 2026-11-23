import { Inject, Injectable } from '@nestjs/common';
import {
  AUDIT_LOG_REPOSITORY,
  type IAuditLogRepository,
} from '../../domain/repositories/audit-log.repository.interface';
import {
  auditActorKind,
  groupAuditEvents,
  needsAttention,
  type AuditActorKind,
} from '../../domain/policies/audit-classification.policy';
import type {
  AuditEvent,
  ListAuditEventsInput,
} from '../../domain/types/audit-event.type';

export type AuditFeedView = 'attention' | 'human' | 'system' | 'all';

export interface GetAuditFeedInput extends Omit<ListAuditEventsInput, 'limit'> {
  view?: AuditFeedView;
  limit?: number;
}

export interface AuditFeedItem {
  event: AuditEvent;
  kind: AuditActorKind;
  attention: boolean;
  count: number;
  firstAt: string;
}

export interface AuditFeedResult {
  items: AuditFeedItem[];
  counts: Record<AuditFeedView, number>;
  hasMore: boolean;
}

/** 감사 화면용 목록: 사람·자동·확인할 일로 나누고 반복 기록을 묶어서 돌려줌 */
@Injectable()
export class GetAuditFeedUseCase {
  constructor(
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepository: IAuditLogRepository,
  ) {}

  async execute({
    view = 'all',
    limit,
    ...filters
  }: GetAuditFeedInput): Promise<AuditFeedResult> {
    const { items } = await this.auditLogRepository.export(filters);
    const classified = items.map((event) => ({
      event,
      kind: auditActorKind(event),
      attention: needsAttention(event),
    }));

    // 탭 숫자는 묶기 전 실제 기록 수로 센다.
    const counts: Record<AuditFeedView, number> = {
      all: classified.length,
      attention: classified.filter((item) => item.attention).length,
      human: classified.filter((item) => item.kind === 'human').length,
      system: classified.filter((item) => item.kind === 'system').length,
    };

    const visible = classified.filter((item) => {
      if (view === 'attention') return item.attention;
      if (view === 'human' || view === 'system') return item.kind === view;
      return true;
    });
    const byId = new Map(visible.map((item) => [item.event.id, item]));
    const groups = groupAuditEvents(visible.map((item) => item.event));
    const pageSize = Math.min(Math.max(limit ?? 60, 1), 300);

    return {
      items: groups.slice(0, pageSize).map((group) => {
        const head = byId.get(group.event.id)!;
        return {
          event: group.event,
          kind: head.kind,
          attention: head.attention,
          count: group.count,
          firstAt: group.firstAt,
        };
      }),
      counts,
      hasMore: groups.length > pageSize,
    };
  }
}
