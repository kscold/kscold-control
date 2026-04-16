import type {
  AuditEvent,
  CreateAuditEventInput,
  ListAuditEventsInput,
} from '../types/audit-event.type';

export interface IAuditLogRepository {
  append(input: CreateAuditEventInput): Promise<AuditEvent>;
  list(input: ListAuditEventsInput): Promise<AuditEvent[]>;
}

export const AUDIT_LOG_REPOSITORY = Symbol('AUDIT_LOG_REPOSITORY');
