import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type { IAuditLogRepository } from '../../domain/interfaces/audit-log.repository.interface';
import type {
  AuditEvent,
  AuditSummary,
  CreateAuditEventInput,
  ListAuditEventsInput,
} from '../../domain/types/audit-event.type';

function resolveAuditLogPath() {
  const currentRoot = process.cwd();
  const backendRoot = currentRoot.endsWith(path.join('apps', 'backend'))
    ? currentRoot
    : path.join(currentRoot, 'apps', 'backend');

  return path.join(backendRoot, 'data', 'audit-log.jsonl');
}

@Injectable()
export class FileAuditLogRepository implements IAuditLogRepository {
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
    } catch {
      return [];
    }
  }

  async summarize(
    input: Omit<ListAuditEventsInput, 'limit'>,
  ): Promise<AuditSummary> {
    const items = this.filterEvents(await this.readAllEvents(), input);
    const threshold = Date.now() - 24 * 60 * 60 * 1000;
    const byDomain: AuditSummary['byDomain'] = {
      repository: 0,
      docker: 0,
      nginx: 0,
      rbac: 0,
    };

    items.forEach((event) => {
      byDomain[event.domain] += 1;
    });

    return {
      total: items.length,
      last24Hours: items.filter(
        (event) => new Date(event.createdAt).getTime() >= threshold,
      ).length,
      byDomain,
    };
  }

  private async readAllEvents(): Promise<AuditEvent[]> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      return raw
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line) as AuditEvent)
        .sort(
          (left, right) =>
            new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
        );
    } catch {
      return [];
    }
  }

  private filterEvents(
    items: AuditEvent[],
    input: Omit<ListAuditEventsInput, 'limit'> | ListAuditEventsInput,
  ) {
    const normalizedSearch = input.search?.trim().toLowerCase() ?? '';

    return items.filter((event) => {
      if (input.domain && input.domain !== 'all' && event.domain !== input.domain) {
        return false;
      }

      if (input.actorId && event.actorId !== input.actorId) {
        return false;
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
}
