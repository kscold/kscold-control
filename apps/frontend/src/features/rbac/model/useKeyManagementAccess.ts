import { useEffect, useState } from 'react';
import { rbacService, type KeyManagementAccessTarget } from '@/entities/user';

export function useKeyManagementAccess() {
  const [targets, setTargets] = useState<KeyManagementAccessTarget[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const matrix = await rbacService.getKeyManagementTargetAccess();
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
      console.error('Failed to load key management target access:', loadError);
      setError('운영 키 대상 범위를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return { targets, assignments, loading, error, reload: load };
}
