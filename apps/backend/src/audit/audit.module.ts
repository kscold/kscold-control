import { Global, Module } from '@nestjs/common';
import { AuditLogService } from './application/services/audit-log.service';
import { AuditController } from './presentation/controllers/audit.controller';
import { AUDIT_LOG_REPOSITORY } from './domain/repositories/audit-log.repository.interface';
import { FileAuditLogRepository } from './infrastructure/repositories/file-audit-log.repository';

@Global()
@Module({
  controllers: [AuditController],
  providers: [
    AuditLogService,
    {
      provide: AUDIT_LOG_REPOSITORY,
      useClass: FileAuditLogRepository,
    },
  ],
  exports: [AuditLogService],
})
export class AuditModule {}
