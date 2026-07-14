import { Inject, Injectable } from '@nestjs/common';
import {
  SYSTEM_STATUS_READER,
  type ISystemStatusReader,
} from '../../domain/repositories/log-reader.repository';
import type { NginxStatus } from '../../domain/types/log.type';

/** Nginx 상태 조회 (GET /logs/nginx/status) */
@Injectable()
export class GetNginxStatusUseCase {
  constructor(
    @Inject(SYSTEM_STATUS_READER)
    private readonly systemStatusReader: ISystemStatusReader,
  ) {}

  execute(): Promise<NginxStatus> {
    return this.systemStatusReader.getNginxStatus();
  }
}
