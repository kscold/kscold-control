import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { parseFstrimBytes } from '../../domain/policies/storage.policy';
import {
  STORAGE_INSPECTION_GATEWAY,
  type IStorageInspectionGateway,
} from '../../domain/repositories/storage-inspection.gateway';
import type { DockerDiskTrimResult } from '../../domain/types/storage.type';
import { GetStorageOverviewUseCase } from './get-storage-overview.use-case';

/**
 * 도커 VM 안에서 지운 공간을 맥에 돌려준다 (fstrim).
 * 서비스를 멈추지 않고 몇 초면 끝나며, 파일은 아무것도 지우지 않는다.
 */
@Injectable()
export class TrimDockerDiskUseCase {
  private running = false;

  constructor(
    @Inject(STORAGE_INSPECTION_GATEWAY)
    private readonly gateway: IStorageInspectionGateway,
    private readonly overview: GetStorageOverviewUseCase,
  ) {}

  async execute(): Promise<DockerDiskTrimResult> {
    if (this.running) {
      throw new ConflictException('이미 공간을 돌려주는 중입니다.');
    }
    this.running = true;
    try {
      const allocatedBeforeBytes = await this.gateway.dockerVmAllocatedBytes();
      const output = await this.gateway.trimDockerDisk();
      const allocatedAfterBytes = await this.gateway.dockerVmAllocatedBytes();
      this.overview.invalidate();
      return {
        trimmedBytes: parseFstrimBytes(output),
        allocatedBeforeBytes,
        allocatedAfterBytes,
      };
    } finally {
      this.running = false;
    }
  }
}
