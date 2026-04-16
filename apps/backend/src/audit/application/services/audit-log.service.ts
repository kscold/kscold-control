import { Inject, Injectable } from '@nestjs/common';
import {
  AUDIT_LOG_REPOSITORY,
  type IAuditLogRepository,
} from '../../domain/interfaces/audit-log.repository.interface';
import type {
  CreateAuditEventInput,
  ListAuditEventsInput,
} from '../../domain/types/audit-event.type';

@Injectable()
export class AuditLogService {
  constructor(
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepository: IAuditLogRepository,
  ) {}

  async record(input: CreateAuditEventInput) {
    return this.auditLogRepository.append(input);
  }

  async list(input: ListAuditEventsInput) {
    return this.auditLogRepository.list(input);
  }

  async summarize(input: Omit<ListAuditEventsInput, 'limit'>) {
    return this.auditLogRepository.summarize(input);
  }

  async export(input: Omit<ListAuditEventsInput, 'limit'>) {
    return this.auditLogRepository.export(input);
  }
}
