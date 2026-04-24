import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type { IAuditLogRepository } from '../../domain/interfaces/audit-log.repository.interface';
import type {
  AuditActorSummary,
  AuditDiffSummary,
  AuditExportResult,
  AuditEvent,
  AuditSummary,
  AuditTargetSummary,
  CreateAuditEventInput,
  ListAuditEventsInput,
} from '../../domain/types/audit-event.type';

function normalizeDate(value?: string) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.getTime();
}

function resolveAuditLogPath() {
  const currentRoot = process.cwd();
  const backendRoot = currentRoot.endsWith(path.join('apps', 'backend'))
    ? currentRoot
    : path.join(currentRoot, 'apps', 'backend');

  return path.join(backendRoot, 'data', 'audit-log.jsonl');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function flattenRecord(
  value: Record<string, unknown>,
  prefix = '',
  output = new Map<string, unknown>(),
) {
  Object.entries(value).forEach(([key, nestedValue]) => {
    const nextPath = prefix ? `${prefix}.${key}` : key;

    if (isRecord(nestedValue) && Object.keys(nestedValue).length > 0) {
      flattenRecord(nestedValue, nextPath, output);
      return;
    }

    output.set(nextPath, nestedValue);
  });

  return output;
}

function buildDiffSummary(metadata: Record<string, unknown>): AuditDiffSummary | null {
  const before = isRecord(metadata.before) ? metadata.before : null;
  const after = isRecord(metadata.after) ? metadata.after : null;

  if (!before && !after) {
    return null;
  }

  const beforeMap = before ? flattenRecord(before) : new Map<string, unknown>();
  const afterMap = after ? flattenRecord(after) : new Map<string, unknown>();
  const keys = Array.from(
    new Set([...beforeMap.keys(), ...afterMap.keys()]),
  ).filter((path) => {
    const beforeValue = beforeMap.get(path);
    const afterValue = afterMap.get(path);
    return JSON.stringify(beforeValue) !== JSON.stringify(afterValue);
  });

  if (keys.length === 0) {
    return null;
  }

  const preview = `${keys.length} changed · ${keys
    .slice(0, 3)
    .join(', ')}${keys.length > 3 ? ` +${keys.length - 3}` : ''}`;

  return {
    changeCount: keys.length,
    keys,
    preview,
  };
}

@Injectable()
export class FileAuditLogRepository implements IAuditLogRepository {
  private readonly logger = new Logger(FileAuditLogRepository.name);
  private readonly filePath = resolveAuditLogPath();

  async append(input: CreateAuditEventInput): Promise<AuditEvent> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    const event: AuditEvent = {
      id: randomUUID(),
      domain: input.domain,
      action: input.action,
      summary: input.summary,
      actorId: input.actorId ?? null,
      actorEmail: input.actorEmail ?? null,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      metadata: input.metadata ?? {},
      createdAt: new Date().toISOString(),
    };

    await fs.appendFile(this.filePath, `${JSON.stringify(event)}\n`, 'utf8');
    return event;
  }

  async list(input: ListAuditEventsInput): Promise<AuditEvent[]> {
    try {
      const items = this.filterEvents(await this.readAllEvents(), input);
      return items.slice(0, Math.min(Math.max(input.limit ?? 100, 1), 500));
    } catch (error) {
      this.logger.error('감사 로그 목록 조회 실패', (error as Error).stack);
      return [];
    }
  }

  async summarize(
    input: Omit<ListAuditEventsInput, 'limit'>,
  ): Promise<AuditSummary> {
    const items = this.filterEvents(await this.readAllEvents(), input);
    return this.buildSummary(items);
  }

  async export(
    input: Omit<ListAuditEventsInput, 'limit'>,
  ): Promise<AuditExportResult> {
    const items = this.filterEvents(await this.readAllEvents(), input);

    return {
      exportedAt: new Date().toISOString(),
      filters: {
        actor: input.actor,
        actorId: input.actorId,
        domain: input.domain ?? 'all',
        from: input.from,
        search: input.search,
        target: input.target,
        targetId: input.targetId,
        to: input.to,
      },
      total: items.length,
      summary: this.buildSummary(items),
      items,
    };
  }

  private async readAllEvents(): Promise<AuditEvent[]> {
    let raw: string;
    try {
      raw = await fs.readFile(this.filePath, 'utf8');
    } catch (error: unknown) {
      // 파일이 없으면 빈 상태 반환 (정상), 다른 오류면 경고 기록
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        this.logger.warn(`감사 로그 파일 읽기 실패: ${(error as Error).message}`);
      }
      return [];
    }

    const events: AuditEvent[] = [];
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        events.push(this.enrichEvent(JSON.parse(line) as AuditEvent));
      } catch {
        this.logger.warn(`잘못된 감사 로그 라인 무시: ${line.slice(0, 80)}`);
      }
    }

    return events.sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );
  }

  private filterEvents(
    items: AuditEvent[],
    input: Omit<ListAuditEventsInput, 'limit'> | ListAuditEventsInput,
  ) {
    const fromTime = normalizeDate(input.from);
    const toTime = normalizeDate(input.to);
    const normalizedActor = input.actor?.trim().toLowerCase() ?? '';
    const normalizedSearch = input.search?.trim().toLowerCase() ?? '';
    const normalizedTarget = input.target?.trim().toLowerCase() ?? '';

    return items.filter((event) => {
      const eventTime = new Date(event.createdAt).getTime();

      if (fromTime !== null && eventTime < fromTime) {
        return false;
      }

      if (toTime !== null && eventTime > toTime) {
        return false;
      }

      if (input.domain && input.domain !== 'all' && event.domain !== input.domain) {
        return false;
      }

      if (normalizedActor) {
        const actorHaystack = [event.actorEmail, event.actorId]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (!actorHaystack.includes(normalizedActor)) {
          return false;
        }
      }

      if (input.actorId && event.actorId !== input.actorId) {
        return false;
      }

      if (normalizedTarget) {
        const targetHaystack = [event.targetType, event.targetId]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (!targetHaystack.includes(normalizedTarget)) {
          return false;
        }
      }

      if (input.targetId && event.targetId !== input.targetId) {
        return false;
      }

      if (normalizedSearch) {
        const haystack = [
          event.summary,
          event.action,
          event.actorEmail,
          event.actorId,
          event.targetType,
          event.targetId,
          event.diffSummary?.preview,
          JSON.stringify(event.metadata),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (!haystack.includes(normalizedSearch)) {
          return false;
        }
      }

      return true;
    });
  }

  private buildSummary(items: AuditEvent[]): AuditSummary {
    const threshold = Date.now() - 24 * 60 * 60 * 1000;
    const byDomain: AuditSummary['byDomain'] = {
      repository: 0,
      docker: 0,
      nginx: 0,
      rbac: 0,
      security: 0,
    };
    const actorMap = new Map<
      string,
      { actorId: string | null; actorEmail: string | null; count: number }
    >();
    const targetMap = new Map<
      string,
      { targetType: string | null; targetId: string | null; count: number }
    >();

    items.forEach((event) => {
      byDomain[event.domain] += 1;

      const actorKey = event.actorEmail ?? event.actorId ?? 'system';
      const existing = actorMap.get(actorKey) ?? {
        actorId: event.actorId,
        actorEmail: event.actorEmail,
        count: 0,
      };
      existing.count += 1;
      actorMap.set(actorKey, existing);

      const targetKey = `${event.targetType ?? 'unknown'}:${event.targetId ?? '-'}`;
      const targetExisting = targetMap.get(targetKey) ?? {
        targetType: event.targetType,
        targetId: event.targetId,
        count: 0,
      };
      targetExisting.count += 1;
      targetMap.set(targetKey, targetExisting);
    });

    const topActors: AuditActorSummary[] = Array.from(actorMap.entries())
      .map(([key, value]) => ({
        key,
        actorId: value.actorId,
        actorEmail: value.actorEmail,
        count: value.count,
      }))
      .sort((left, right) => {
        if (right.count !== left.count) {
          return right.count - left.count;
        }

        return left.key.localeCompare(right.key);
      })
      .slice(0, 6);

    const topTargets: AuditTargetSummary[] = Array.from(targetMap.entries())
      .map(([key, value]) => ({
        key,
        targetId: value.targetId,
        targetType: value.targetType,
        count: value.count,
      }))
      .sort((left, right) => {
        if (right.count !== left.count) {
          return right.count - left.count;
        }

        return left.key.localeCompare(right.key);
      })
      .slice(0, 6);

    return {
      total: items.length,
      last24Hours: items.filter(
        (event) => new Date(event.createdAt).getTime() >= threshold,
      ).length,
      byDomain,
      topActors,
      topTargets,
    };
  }

  private enrichEvent(event: AuditEvent): AuditEvent {
    return {
      ...event,
      diffSummary: buildDiffSummary(event.metadata ?? {}),
    };
  }
}
