import { Inject, Injectable } from '@nestjs/common';
import {
  AUDIT_LOG_REPOSITORY,
  type IAuditLogRepository,
} from '../../domain/repositories/audit-log.repository.interface';
import type { ListAuditEventsInput } from '../../domain/types/audit-event.type';

/** 감사 이벤트 목록 조회 */
@Injectable()
export class ListAuditEventsUseCase {
  constructor(
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepository: IAuditLogRepository,
  ) {}

  execute(input: ListAuditEventsInput) {
    return this.auditLogRepository.list(input);
  }
}
