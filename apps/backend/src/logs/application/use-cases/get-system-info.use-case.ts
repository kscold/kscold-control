import { Inject, Injectable } from '@nestjs/common';
import {
  SYSTEM_STATUS_READER,
  type ISystemStatusReader,
} from '../../domain/repositories/log-reader.repository';
import type { SystemInfo } from '../../domain/types/log.type';

/** 시스템 정보 조회 (GET /logs/system) */
@Injectable()
export class GetSystemInfoUseCase {
  constructor(
    @Inject(SYSTEM_STATUS_READER)
    private readonly systemStatusReader: ISystemStatusReader,
  ) {}

  execute(): Promise<SystemInfo | null> {
    return this.systemStatusReader.getSystemInfo();
  }
}
