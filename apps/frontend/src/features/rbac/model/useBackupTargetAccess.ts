import { useCallback, useEffect, useState } from 'react';
import { rbacService, type BackupAccessTarget } from '@/entities/user';

/** 사용자별 백업 열람 범위(대상 목록 + 배정 현황)를 불러온다. */
export function useBackupTargetAccess() {
  const [targets, setTargets] = useState<BackupAccessTarget[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const matrix = await rbacService.getBackupTargetAccess();
      setTargets(matrix.targets);
      setAssignments(
        Object.fromEntries(
          matrix.assignments.map((assignment) => [
            assignment.userId,
            assignment.targetIds,
          ]),
        ),
      );
    } catch (loadError) {
      console.error('Failed to load backup target access:', loadError);
      setError('백업 열람 범위를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { targets, assignments, loading, error, reload: load };
}
