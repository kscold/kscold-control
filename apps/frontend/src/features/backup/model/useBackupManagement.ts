import { useCallback, useEffect, useRef, useState } from 'react';
import { backupTargetService } from '../api/backup-target.service';
import type {
  BackupOverview,
  BackupRun,
  BackupTargetStatus,
  CreateBackupTargetInput,
  UpdateBackupTargetInput,
} from './backup.types';

/** 백업이 도는 동안의 갱신 주기 */
const RUNNING_REFRESH_MS = 3_000;

/** 평소 갱신 주기 — 화면을 띄워 둔 사이 시작된 예약 실행을 놓치지 않으려고 둔다 */
const IDLE_REFRESH_MS = 30_000;

const RUN_HISTORY_LIMIT = 30;

/** 실행 이력을 모든 대상에 대해 볼 때의 필터 값 */
export const ALL_TARGETS = 'all';

interface UseBackupManagementOptions {
  /** 실행 중이던 대상의 백업이 끝났을 때 한 번 불린다. */
  onRunFinished?: (target: BackupTargetStatus) => void;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useBackupManagement(options: UseBackupManagementOptions = {}) {
  const [overview, setOverview] = useState<BackupOverview | null>(null);
  const [runs, setRuns] = useState<BackupRun[]>([]);
  const [runFilter, setRunFilter] = useState<string>(ALL_TARGETS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const onRunFinishedRef = useRef(options.onRunFinished);
  onRunFinishedRef.current = options.onRunFinished;

  /** 늦게 도착한 이전 응답이 최신 화면을 덮어쓰지 않게 요청 순번을 센다. */
  const requestSequenceRef = useRef(0);
  const hasLoadedRef = useRef(false);
  const runningIdsRef = useRef<Set<string>>(new Set());

  const refresh = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      const sequence = (requestSequenceRef.current += 1);
      if (!silent) setLoading(true);

      try {
        const [nextOverview, nextRuns] = await Promise.all([
          backupTargetService.getOverview(),
          backupTargetService.listRuns({
            targetId: runFilter === ALL_TARGETS ? undefined : runFilter,
            limit: RUN_HISTORY_LIMIT,
          }),
        ]);
        if (sequence !== requestSequenceRef.current) return;

        const finished = nextOverview.items.filter(
          (item) => !item.running && runningIdsRef.current.has(item.id),
        );
        runningIdsRef.current = new Set(
          nextOverview.items
            .filter((item) => item.running)
            .map((item) => item.id),
        );

        setOverview(nextOverview);
        setRuns(nextRuns);
        setError(null);
        hasLoadedRef.current = true;
        finished.forEach((item) => onRunFinishedRef.current?.(item));
      } catch (caught) {
        if (sequence !== requestSequenceRef.current) return;
        // 보고 있던 내용은 그대로 두고 오류만 알린다.
        setError(toMessage(caught));
      } finally {
        if (sequence === requestSequenceRef.current) setLoading(false);
      }
    },
    [runFilter],
  );

  // 처음 열 때와 이력 필터를 바꿀 때 불러온다. 필터 변경은 화면을 비우지 않고 갱신한다.
  useEffect(() => {
    void refresh({ silent: hasLoadedRef.current });
  }, [refresh]);

  const anyRunning = overview?.items.some((item) => item.running) ?? false;

  useEffect(() => {
    const id = window.setInterval(
      () => {
        if (document.visibilityState === 'visible') {
          void refresh({ silent: true });
        }
      },
      anyRunning ? RUNNING_REFRESH_MS : IDLE_REFRESH_MS,
    );
    return () => window.clearInterval(id);
  }, [anyRunning, refresh]);

  const createTarget = useCallback(
    async (input: CreateBackupTargetInput) => {
      const target = await backupTargetService.createTarget(input);
      await refresh({ silent: true });
      return target;
    },
    [refresh],
  );

  const updateTarget = useCallback(
    async (id: string, input: UpdateBackupTargetInput) => {
      const target = await backupTargetService.updateTarget(id, input);
      await refresh({ silent: true });
      return target;
    },
    [refresh],
  );

  const removeTarget = useCallback(
    async (id: string) => {
      const target = await backupTargetService.removeTarget(id);
      // 지운 대상의 이력을 보고 있었다면 전체 보기로 돌린다. 필터가 바뀌면 다시 불러온다.
      if (runFilter === id) {
        setRunFilter(ALL_TARGETS);
      } else {
        await refresh({ silent: true });
      }
      return target;
    },
    [refresh, runFilter],
  );

  const runTarget = useCallback(
    async (id: string) => {
      const run = await backupTargetService.runTarget(id);
      // 덤프가 다음 조회보다 먼저 끝나도 완료 알림이 나가도록 실행 중으로 표시해 둔다.
      runningIdsRef.current.add(id);
      await refresh({ silent: true });
      return run;
    },
    [refresh],
  );

  return {
    overview,
    runs,
    runFilter,
    setRunFilter,
    loading,
    error,
    anyRunning,
    refresh,
    createTarget,
    updateTarget,
    removeTarget,
    runTarget,
  };
}
