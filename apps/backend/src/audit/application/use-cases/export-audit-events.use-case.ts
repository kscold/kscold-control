import { Inject, Injectable } from '@nestjs/common';
import {
  AUDIT_LOG_REPOSITORY,
  type IAuditLogRepository,
} from '../../domain/repositories/audit-log.repository.interface';
import type { ListAuditEventsInput } from '../../domain/types/audit-event.type';

/** 감사 이벤트 내보내기(JSON/CSV 원본 데이터) */
@Injectable()
export class ExportAuditEventsUseCase {
  constructor(
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepository: IAuditLogRepository,
  ) {}

  execute(input: Omit<ListAuditEventsInput, 'limit'>) {
    return this.auditLogRepository.export(input);
  }
}
