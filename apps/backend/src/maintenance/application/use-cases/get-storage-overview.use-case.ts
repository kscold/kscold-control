import { Inject, Injectable } from '@nestjs/common';
import {
  STORAGE_INSPECTION_GATEWAY,
  type IStorageInspectionGateway,
} from '../../domain/gateways/storage-inspection.gateway.interface';
import type { StorageOverview } from '../../domain/types/storage.type';
import { storageFolders } from '../config/storage-folders.config';

/** 폴더 크기를 재는 데 수십 초 걸릴 수 있어 이 시간 동안은 결과를 다시 쓴다 */
const CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * 저장공간 현황 — 맥 디스크, 도커 VM 디스크, 도커 안 사용량, 큰 폴더를 한 번에 잰다.
 * 항목 하나를 못 읽어도 나머지는 보여주고 이유는 warnings에 담는다.
 */
@Injectable()
export class GetStorageOverviewUseCase {
  private cached: { value: StorageOverview; expiresAt: number } | null = null;
  private pending: Promise<StorageOverview> | null = null;

  constructor(
    @Inject(STORAGE_INSPECTION_GATEWAY)
    private readonly gateway: IStorageInspectionGateway,
  ) {}

  async execute({ refresh = false } = {}): Promise<StorageOverview> {
    if (!refresh && this.cached && this.cached.expiresAt > Date.now()) {
      return this.cached.value;
    }
    // 여러 사람이 동시에 열어도 측정은 한 번만 돈다
    this.pending ??= this.measure().finally(() => {
      this.pending = null;
    });
    const value = await this.pending;
    this.cached = { value, expiresAt: Date.now() + CACHE_TTL_MS };
    return value;
  }

  /** 공간을 바꾼 뒤 다음 조회가 새로 재도록 한다 */
  invalidate(): void {
    this.cached = null;
  }

  private async measure(): Promise<StorageOverview> {
    const warnings: string[] = [];
    const attempt = async <T>(
      label: string,
      task: () => Promise<T>,
    ): Promise<T | null> => {
      try {
        return await task();
      } catch (error) {
        warnings.push(
          `${label}: ${error instanceof Error ? error.message : String(error)}`,
        );
        return null;
      }
    };

    const folders = storageFolders();
    const [host, allocated, used, held, docker, sizes] = await Promise.all([
      attempt('맥 디스크', () => this.gateway.hostDisk()),
      attempt('도커 VM 디스크', () => this.gateway.dockerVmAllocatedBytes()),
      attempt('VM 안 사용량', () => this.gateway.dockerVmUsedBytes()),
      attempt('VM이 열어 둔 파일', () => this.gateway.heldDeletedFiles()),
      attempt('도커 사용량', () => this.gateway.dockerUsage()),
      Promise.all(
        folders.map((folder) =>
          attempt(folder.label, () => this.gateway.folderSize(folder.path)),
        ),
      ),
    ]);

    return {
      measuredAt: new Date(),
      host,
      dockerVm:
        allocated === null
          ? null
          : {
              path: this.gateway.dockerVmDiskPath(),
              allocatedBytes: allocated,
              usedBytes: used,
              reclaimableBytes:
                used === null ? null : Math.max(0, allocated - used),
              heldDeletedBytes: held?.bytes ?? null,
              heldDeletedFiles: held?.files ?? 0,
            },
      docker,
      folders: folders.map((folder, index) => ({
        ...folder,
        sizeBytes: sizes[index],
      })),
      warnings,
    };
  }
}
