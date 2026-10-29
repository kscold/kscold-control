import { Inject, Injectable } from '@nestjs/common';
import os from 'node:os';
import path from 'node:path';
import {
  STORAGE_INSPECTION_GATEWAY,
  type IStorageInspectionGateway,
} from '../../domain/repositories/storage-inspection.gateway';
import type {
  StorageFolderDefinition,
  StorageOverview,
} from '../../domain/types/storage.type';

/** 폴더 크기를 재는 데 수십 초 걸릴 수 있어 이 시간 동안은 결과를 다시 쓴다 */
const CACHE_TTL_MS = 10 * 60 * 1000;

/** 어느 맥에서나 커지기 쉬운 폴더 — 개발 도구가 버전·세션마다 쌓아 두는 곳 */
function defaultFolders(home: string): StorageFolderDefinition[] {
  return [
    {
      key: 'codex-sessions',
      label: 'Codex 대화 기록',
      description: '오래 이어 쓴 세션 하나가 수백 MB까지 커짐',
      path: path.join(home, '.codex/sessions'),
    },
    {
      key: 'codex-packages',
      label: 'Codex 실행 파일',
      description: '업데이트할 때마다 이전 버전이 남음',
      path: path.join(home, '.codex/packages'),
    },
    {
      key: 'claude-projects',
      label: 'Claude Code 대화 기록',
      description: '프로젝트별 세션 기록',
      path: path.join(home, '.claude/projects'),
    },
    {
      key: 'claude-versions',
      label: 'Claude Code 실행 파일',
      description: '업데이트할 때마다 이전 버전이 남음',
      path: path.join(home, '.local/share/claude/versions'),
    },
    {
      key: 'pnpm-store',
      label: 'pnpm 패키지 저장소',
      description: '여러 프로젝트가 나눠 쓰는 패키지 원본',
      path: path.join(home, 'Library/pnpm'),
    },
    {
      key: 'playwright',
      label: 'Playwright 브라우저',
      description: 'Playwright 버전마다 브라우저가 따로 깔림',
      path: path.join(home, 'Library/Caches/ms-playwright'),
    },
    {
      key: 'vscode-server',
      label: 'VS Code 원격 서버',
      description: '접속한 VS Code 버전마다 서버가 따로 깔림',
      path: path.join(home, '.vscode-server'),
    },
    {
      key: 'trash',
      label: '휴지통',
      description: '비우기 전까지 공간을 그대로 차지함',
      path: path.join(home, '.Trash'),
    },
    {
      key: 'tmp',
      label: '임시 폴더',
      description: '맥을 다시 시작하면 비워짐',
      path: '/private/tmp',
    },
  ];
}

/**
 * 이 맥에만 있는 폴더는 STORAGE_EXTRA_FOLDERS에 JSON 배열로 더한다.
 * 예: [{"label":"이관 백업","path":"~/.config/app/backups","description":"최신 하나만 남김"}]
 */
export function storageFolders(
  env: NodeJS.ProcessEnv = process.env,
  home: string = os.homedir(),
): StorageFolderDefinition[] {
  const folders = defaultFolders(home);
  if (!env.STORAGE_EXTRA_FOLDERS) return folders;
  try {
    const extras = JSON.parse(env.STORAGE_EXTRA_FOLDERS) as Array<
      Partial<StorageFolderDefinition>
    >;
    extras.forEach((extra, index) => {
      if (!extra.label || !extra.path) return;
      folders.push({
        key: extra.key ?? `extra-${index + 1}`,
        label: extra.label,
        description: extra.description ?? '',
        path: extra.path.startsWith('~/')
          ? path.join(home, extra.path.slice(2))
          : extra.path,
      });
    });
  } catch {
    // 설정을 잘못 적어도 기본 목록은 보여준다
  }
  return folders;
}

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
