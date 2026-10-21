import { useCallback, useEffect, useRef, useState } from 'react';
import { worktreeCleanupService } from '../api/worktree-cleanup.service';
import type {
  WorktreeCleanupOverview,
  WorktreeCleanupRun,
  WorktreeCleanupTargetStatus,
} from './maintenance.types';

const RUNNING_REFRESH_MS = 3_000;
const IDLE_REFRESH_MS = 30_000;

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** 정리 대상 현황과 이력을 불러오고, 정리가 도는 동안에는 자주 갱신한다. */
export function useWorktreeCleanup(
  options: {
    onRunFinished?: (target: WorktreeCleanupTargetStatus) => void;
  } = {},
) {
  const [overview, setOverview] = useState<WorktreeCleanupOverview | null>(
    null,
  );
  const [runs, setRuns] = useState<WorktreeCleanupRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const onRunFinishedRef = useRef(options.onRunFinished);
  onRunFinishedRef.current = options.onRunFinished;
  const sequenceRef = useRef(0);
  const runningIdsRef = useRef<Set<string>>(new Set());

  const refresh = useCallback(async ({ silent = false } = {}) => {
    const sequence = (sequenceRef.current += 1);
    if (!silent) setLoading(true);
    try {
      const [nextOverview, nextRuns] = await Promise.all([
        worktreeCleanupService.getOverview(),
        worktreeCleanupService.listRuns({ limit: 30 }),
      ]);
      if (sequence !== sequenceRef.current) return;
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
      finished.forEach((item) => onRunFinishedRef.current?.(item));
    } catch (caught) {
      if (sequence === sequenceRef.current) setError(toMessage(caught));
    } finally {
      if (sequence === sequenceRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const anyRunning = overview?.items.some((item) => item.running) ?? false;
  useEffect(() => {
    const id = window.setInterval(
      () => {
        if (document.visibilityState === 'visible')
          void refresh({ silent: true });
      },
      anyRunning ? RUNNING_REFRESH_MS : IDLE_REFRESH_MS,
    );
    return () => window.clearInterval(id);
  }, [anyRunning, refresh]);

  const markRunning = useCallback((id: string) => {
    // 정리가 다음 조회보다 먼저 끝나도 완료 알림이 나가도록 실행 중으로 표시해 둔다.
    runningIdsRef.current.add(id);
  }, []);

  return { overview, runs, loading, error, refresh, markRunning };
}
