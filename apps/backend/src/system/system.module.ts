import { Module } from '@nestjs/common';

import { SystemService } from './application/services/system.service';
import { OS_METRICS_REPOSITORY } from './domain/interfaces/os-metrics.repository';
import { OsMetricsRepositoryImpl } from './infrastructure/repositories/os-metrics.repository.impl';
import { SystemController } from './presentation/controllers/system.controller';

@Module({
  controllers: [SystemController],
  providers: [
    SystemService,
    { provide: OS_METRICS_REPOSITORY, useClass: OsMetricsRepositoryImpl },
  ],
})
export class SystemModule {}
