import { ConflictException } from '@nestjs/common';
import {
  GetStorageOverviewUseCase,
  storageFolders,
  TrimDockerDiskUseCase,
} from '@/maintenance/application/use-cases';
import type { IStorageInspectionGateway } from '@/maintenance/domain/repositories/storage-inspection.gateway';
import { trimRunRepository } from '../storage-trim-run.fake';

const GiB = 1024 ** 3;

function gateway(
  overrides: Partial<IStorageInspectionGateway> = {},
): jest.Mocked<IStorageInspectionGateway> {
  return {
    hostDisk: jest.fn().mockResolvedValue({
      totalBytes: 228 * GiB,
      usedBytes: 172 * GiB,
      freeBytes: 56 * GiB,
    }),
    dockerVmDiskPath: jest.fn().mockReturnValue('/home/example/vm/datadisk'),
    dockerVmAllocatedBytes: jest.fn().mockResolvedValue(62 * GiB),
    dockerVmUsedBytes: jest.fn().mockResolvedValue(47 * GiB),
    heldDeletedFiles: jest.fn().mockResolvedValue({ bytes: 3 * GiB, files: 2 }),
    dockerUsage: jest.fn().mockResolvedValue({
      containers: [],
      unusedImages: [],
      unreferencedVolumes: [],
      buildCacheBytes: 0,
    }),
    folderSize: jest.fn().mockResolvedValue(GiB),
    trimDockerDisk: jest
      .fn()
      .mockResolvedValue(
        '/var/lib/docker: 63.6 GiB (68308602880 bytes) trimmed',
      ),
    ...overrides,
  } as jest.Mocked<IStorageInspectionGateway>;
}

describe('저장공간 유스케이스', () => {
  it('VM 디스크가 맥에서 차지하는 크기와 실제 사용량의 차이를 돌려줄 수 있는 공간으로 보여준다', async () => {
    const overview = await new GetStorageOverviewUseCase(gateway()).execute();

    expect(overview.host?.freeBytes).toBe(56 * GiB);
    expect(overview.dockerVm).toMatchObject({
      allocatedBytes: 62 * GiB,
      usedBytes: 47 * GiB,
      reclaimableBytes: 15 * GiB,
      heldDeletedBytes: 3 * GiB,
      heldDeletedFiles: 2,
    });
    expect(overview.folders.every((folder) => folder.sizeBytes === GiB)).toBe(
      true,
    );
    expect(overview.warnings).toEqual([]);
  });

  it('한 항목을 못 읽어도 나머지는 보여주고 이유를 남긴다', async () => {
    const overview = await new GetStorageOverviewUseCase(
      gateway({
        dockerVmUsedBytes: jest
          .fn()
          .mockRejectedValue(new Error('colima 시간 초과')),
        dockerUsage: jest.fn().mockRejectedValue(new Error('소켓 없음')),
      }),
    ).execute();

    expect(overview.dockerVm).toMatchObject({
      allocatedBytes: 62 * GiB,
      usedBytes: null,
      reclaimableBytes: null,
    });
    expect(overview.docker).toBeNull();
    expect(overview.host).not.toBeNull();
    expect(overview.warnings).toEqual([
      'VM 안 사용량: colima 시간 초과',
      '도커 사용량: 소켓 없음',
    ]);
  });

  it('잰 결과를 다시 쓰다가 새로 재기를 요청하거나 공간을 돌려준 뒤에는 다시 잰다', async () => {
    const inspection = gateway({
      dockerVmAllocatedBytes: jest
        .fn()
        .mockResolvedValueOnce(62 * GiB)
        .mockResolvedValueOnce(62 * GiB)
        .mockResolvedValueOnce(62 * GiB)
        .mockResolvedValueOnce(28 * GiB)
        .mockResolvedValue(28 * GiB),
    });
    const overview = new GetStorageOverviewUseCase(inspection);
    const trim = new TrimDockerDiskUseCase(
      inspection,
      trimRunRepository(),
      overview,
    );

    await overview.execute();
    await overview.execute();
    expect(inspection.hostDisk).toHaveBeenCalledTimes(1);

    await overview.execute({ refresh: true });
    expect(inspection.hostDisk).toHaveBeenCalledTimes(2);

    await expect(trim.execute()).resolves.toEqual({
      trimmedBytes: 68308602880,
      allocatedBeforeBytes: 62 * GiB,
      allocatedAfterBytes: 28 * GiB,
    });
    await overview.execute();
    expect(inspection.hostDisk).toHaveBeenCalledTimes(3);
  });

  it('공간 반환이 진행 중이면 한 번 더 시작하지 않는다', async () => {
    let finish: (output: string) => void = () => undefined;
    const inspection = gateway({
      trimDockerDisk: jest.fn(
        () =>
          new Promise<string>((resolve) => {
            finish = resolve;
          }),
      ),
    });
    const trim = new TrimDockerDiskUseCase(
      inspection,
      trimRunRepository(),
      new GetStorageOverviewUseCase(inspection),
    );

    const first = trim.execute();
    await Promise.resolve();
    await Promise.resolve();
    await expect(trim.execute()).rejects.toBeInstanceOf(ConflictException);
    finish('');
    await expect(first).resolves.toMatchObject({ trimmedBytes: null });
  });

  it('이 맥에만 있는 폴더는 환경 변수로 더하고 잘못 적어도 기본 목록은 남긴다', () => {
    const extra = storageFolders(
      {
        STORAGE_EXTRA_FOLDERS: JSON.stringify([
          { label: '이관 백업', path: '~/backups', description: '최신 하나만' },
          { label: '경로 없음' },
        ]),
      },
      '/home/example',
    );
    const broken = storageFolders(
      { STORAGE_EXTRA_FOLDERS: '[{' },
      '/home/example',
    );

    expect(extra.at(-1)).toEqual({
      key: 'extra-1',
      label: '이관 백업',
      description: '최신 하나만',
      path: '/home/example/backups',
    });
    expect(extra).toHaveLength(broken.length + 1);
    expect(broken.every((folder) => folder.path.startsWith('/'))).toBe(true);
  });
});
