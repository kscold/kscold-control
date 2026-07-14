import { Inject, Injectable } from '@nestjs/common';
import {
  AUDIT_LOG_REPOSITORY,
  type IAuditLogRepository,
} from '../../domain/repositories/audit-log.repository.interface';
import type { CreateAuditEventInput } from '../../domain/types/audit-event.type';

/**
 * 감사 로그 기록 — 여러 모듈이 주입해 사용하는 횡단(cross-cutting) 인프라.
 * 조회/요약/내보내기는 use-case(컨트롤러 진입점)로 분리했다.
 */
@Injectable()
export class AuditLogService {
  constructor(
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepository: IAuditLogRepository,
  ) {}

  record(input: CreateAuditEventInput) {
    return this.auditLogRepository.append(input);
  }
}
