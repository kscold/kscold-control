import type { StorageTrimRun } from '@/maintenance/domain/entities/storage-trim-run.entity';
import type { IStorageTrimRunRepository } from '@/maintenance/domain/repositories/storage-trim-run.repository';

/** 메모리에 기록하는 공간 반환 기록 저장소 */
export function trimRunRepository(): jest.Mocked<IStorageTrimRunRepository> {
  const runs: StorageTrimRun[] = [];
  return {
    start: jest.fn(async (input) => {
      const run = {
        id: `run-${runs.length + 1}`,
        trigger: input.trigger,
        status: 'running',
        message: '',
        allocatedBeforeBytes: null,
        allocatedAfterBytes: null,
        trimmedBytes: null,
        actorEmail: input.actorEmail,
        startedAt: new Date(),
        finishedAt: null,
      } as StorageTrimRun;
      runs.push(run);
      return run;
    }),
    finish: jest.fn(async (id, input) =>
      Object.assign(
        runs.find((run) => run.id === id)!,
        input,
        {
          finishedAt: new Date(),
        },
      ),
    ),
    listRecent: jest.fn(async (limit) => [...runs].reverse().slice(0, limit)),
    findLatestScheduled: jest.fn(
      async () =>
        [...runs].reverse().find((run) => run.trigger === 'schedule') ?? null,
    ),
    failUnfinished: jest.fn(async (_message: string) => 0),
  };
}
