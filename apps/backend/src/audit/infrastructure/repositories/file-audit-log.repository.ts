import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type { IAuditLogRepository } from '../../domain/interfaces/audit-log.repository.interface';
import type {
  AuditEvent,
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
      const raw = await fs.readFile(this.filePath, 'utf8');
      const items = raw
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line) as AuditEvent)
        .filter((event) => {
          if (input.domain && input.domain !== 'all' && event.domain !== input.domain) {
            return false;
          }

          if (input.actorId && event.actorId !== input.actorId) {
            return false;
          }

          if (input.targetId && event.targetId !== input.targetId) {
            return false;
          }

          return true;
        })
        .sort(
          (left, right) =>
            new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
        );

      return items.slice(0, Math.min(Math.max(input.limit ?? 100, 1), 500));
    } catch {
      return [];
    }
  }
}
