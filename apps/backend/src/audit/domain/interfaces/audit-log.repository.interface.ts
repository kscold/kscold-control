import type {
  AuditExportResult,
  AuditEvent,
  AuditSummary,
  CreateAuditEventInput,
  ListAuditEventsInput,
} from '../types/audit-event.type';

export interface IAuditLogRepository {
  append(input: CreateAuditEventInput): Promise<AuditEvent>;
  list(input: ListAuditEventsInput): Promise<AuditEvent[]>;
  summarize(input: Omit<ListAuditEventsInput, 'limit'>): Promise<AuditSummary>;
  export(input: Omit<ListAuditEventsInput, 'limit'>): Promise<AuditExportResult>;
}

export const AUDIT_LOG_REPOSITORY = Symbol('AUDIT_LOG_REPOSITORY');
