import type { AuditEvent } from '../types/audit-event.type';

export type AuditActorKind = 'human' | 'system';

/**
 * 나중에 다시 확인해야 하는 위험한 동작.
 * 비밀값 열람·변경, 권한 변경, 차단 해제, 삭제처럼 되돌리기 어렵거나 노출이 생기는 일만 넣는다.
 */
const ATTENTION_ACTIONS: Record<string, readonly string[]> = {
  secrets: [
    'secret.reveal',
    'secret.update',
    'secret.patch-key',
    'secret.restore',
    'ssh-key.create',
    'ssh-key.delete',
    'ssh-key.download',
  ],
  rbac: [
    'user.create',
    'user.delete',
    'user.assign-roles',
    'user.approve-key-manager',
    'user.set-backup-target-access',
    'user.set-key-management-target-access',
    'impersonation.start',
  ],
  security: [
    'ban.delete',
    'ssh.block.delete',
    'ssh.known-ip.add',
    'ssh.country-guard.update',
    'ssh.country-guard.unblock-country',
    'ssh.session.terminate',
  ],
  repository: ['project.delete', 'versions.restore'],
  nginx: ['site.delete'],
  docker: ['container.remove', 'compose.remove-service'],
  backup: ['target.delete'],
};

/** 짧은 시간에 같은 일이 반복되면 한 줄로 묶을 동작. */
const GROUPABLE_ACTION_PREFIXES = ['upload.', 'topology.layout.'];

/** 묶을 때 같은 사람의 같은 동작 사이 간격이 이보다 길면 새 묶음으로 나눈다. */
export const AUDIT_GROUP_GAP_MS = 10 * 60_000;

export function auditActorKind(
  event: Pick<AuditEvent, 'actorId' | 'actorEmail'>,
): AuditActorKind {
  return event.actorId || event.actorEmail ? 'human' : 'system';
}

export function needsAttention(
  event: Pick<AuditEvent, 'domain' | 'action'>,
): boolean {
  return ATTENTION_ACTIONS[event.domain]?.includes(event.action) ?? false;
}

function isGroupable(event: Pick<AuditEvent, 'action'>): boolean {
  return GROUPABLE_ACTION_PREFIXES.some((prefix) =>
    event.action.startsWith(prefix),
  );
}

export interface AuditEventGroup<T extends AuditEvent = AuditEvent> {
  /** 묶음에서 가장 최근 기록 */
  event: T;
  count: number;
  /** 묶음에서 가장 오래된 기록 시각 */
  firstAt: string;
  eventIds: string[];
}

/**
 * 최신순으로 정렬된 기록에서 같은 사람·같은 동작·같은 대상이 짧은 간격으로 이어지면 하나로 묶는다.
 * 묶을 수 없는 동작은 늘 한 줄씩 둔다.
 */
export function groupAuditEvents<T extends AuditEvent>(
  events: T[],
): AuditEventGroup<T>[] {
  const groups: AuditEventGroup<T>[] = [];
  for (const event of events) {
    const last = groups.at(-1);
    const canJoin =
      last &&
      isGroupable(event) &&
      last.event.domain === event.domain &&
      last.event.action === event.action &&
      last.event.actorId === event.actorId &&
      last.event.targetId === event.targetId &&
      Date.parse(last.firstAt) - Date.parse(event.createdAt) <=
        AUDIT_GROUP_GAP_MS;
    if (canJoin) {
      last.count += 1;
      last.firstAt = event.createdAt;
      last.eventIds.push(event.id);
      continue;
    }
    groups.push({
      event,
      count: 1,
      firstAt: event.createdAt,
      eventIds: [event.id],
    });
  }
  return groups;
}
