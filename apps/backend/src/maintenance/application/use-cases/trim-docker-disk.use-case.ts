import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { parseFstrimBytes } from '../../domain/policies/storage.policy';
import {
  STORAGE_INSPECTION_GATEWAY,
  type IStorageInspectionGateway,
} from '../../domain/repositories/storage-inspection.gateway';
import {
  STORAGE_TRIM_RUN_REPOSITORY,
  type IStorageTrimRunRepository,
} from '../../domain/repositories/storage-trim-run.repository';
import type { StorageTrimTrigger } from '../../domain/types/automation.type';
import type { DockerDiskTrimResult } from '../../domain/types/storage.type';
import { GetStorageOverviewUseCase } from './get-storage-overview.use-case';

function formatGiB(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(1)} GiB`;
}

/**
 * 도커 VM 안에서 지운 공간을 맥에 돌려준다 (fstrim).
 * 서비스를 멈추지 않고 몇 초면 끝나며, 파일은 아무것도 지우지 않는다.
 * 버튼으로 돌린 것과 매일 예약으로 돈 것 모두 기록을 남긴다.
 */
@Injectable()
export class TrimDockerDiskUseCase {
  private running = false;

  constructor(
    @Inject(STORAGE_INSPECTION_GATEWAY)
    private readonly gateway: IStorageInspectionGateway,
    @Inject(STORAGE_TRIM_RUN_REPOSITORY)
    private readonly runRepository: IStorageTrimRunRepository,
    private readonly overview: GetStorageOverviewUseCase,
  ) {}

  isRunning(): boolean {
    return this.running;
  }

  async execute({
    trigger = 'manual' as StorageTrimTrigger,
    actorEmail = null as string | null,
  } = {}): Promise<DockerDiskTrimResult> {
    if (this.running) {
      throw new ConflictException('이미 공간을 돌려주는 중입니다.');
    }
    this.running = true;
    const run = await this.runRepository.start({ trigger, actorEmail });
    let allocatedBeforeBytes: number | null = null;
    try {
      allocatedBeforeBytes = await this.gateway.dockerVmAllocatedBytes();
      const output = await this.gateway.trimDockerDisk();
      const allocatedAfterBytes = await this.gateway.dockerVmAllocatedBytes();
      const result = {
        trimmedBytes: parseFstrimBytes(output),
        allocatedBeforeBytes,
        allocatedAfterBytes,
      };
      await this.runRepository.finish(run.id, {
        status: 'succeeded',
        message: `맥에 ${formatGiB(Math.max(0, allocatedBeforeBytes - allocatedAfterBytes))}를 돌려줬습니다.`,
        ...result,
      });
      this.overview.invalidate();
      return result;
    } catch (error) {
      await this.runRepository.finish(run.id, {
        status: 'failed',
        message: error instanceof Error ? error.message : String(error),
        allocatedBeforeBytes,
        allocatedAfterBytes: null,
        trimmedBytes: null,
      });
      throw error;
    } finally {
      this.running = false;
    }
  }
}
