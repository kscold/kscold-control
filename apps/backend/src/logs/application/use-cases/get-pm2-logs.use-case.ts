import { Inject, Injectable } from '@nestjs/common';
import {
  PM2_LOG_READER,
  type IPm2LogReader,
} from '../../domain/repositories/log-reader.repository';
import type { Pm2LogResult } from '../../domain/types/log.type';

/** PM2 로그 조회 (GET /logs/pm2) */
@Injectable()
export class GetPm2LogsUseCase {
  constructor(
    @Inject(PM2_LOG_READER)
    private readonly pm2LogReader: IPm2LogReader,
  ) {}

  execute(lines: number = 100): Promise<Pm2LogResult> {
    return this.pm2LogReader.getPm2Logs(lines);
  }
}
