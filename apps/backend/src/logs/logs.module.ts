import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LogsController } from './presentation/controllers/logs.controller';
import { LogsService } from './application/services/logs.service';
import {
  FILE_LOG_READER,
  DOCKER_LOG_READER,
  PM2_LOG_READER,
  SYSTEM_STATUS_READER,
} from './domain/interfaces/log-reader.repository';
import { FileLogReaderRepository } from './infrastructure/repositories/file-log-reader.repository';
import { DockerLogReaderRepository } from './infrastructure/repositories/docker-log-reader.repository';
import { Pm2LogReaderRepository } from './infrastructure/repositories/pm2-log-reader.repository';
import { SystemStatusReaderRepository } from './infrastructure/repositories/system-status-reader.repository';

@Module({
  imports: [AuthModule],
  controllers: [LogsController],
  providers: [
    LogsService,
    { provide: FILE_LOG_READER, useClass: FileLogReaderRepository },
    { provide: DOCKER_LOG_READER, useClass: DockerLogReaderRepository },
    { provide: PM2_LOG_READER, useClass: Pm2LogReaderRepository },
    { provide: SYSTEM_STATUS_READER, useClass: SystemStatusReaderRepository },
  ],
  exports: [LogsService],
})
export class LogsModule {}
