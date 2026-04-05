import { useCallback, useEffect, useState } from 'react';
import { dockerService } from '../../../services/api/docker.service';
import type { DockerCleanupCandidates } from '../lib/docker-cleanup.types';

export function useDockerCleanupCandidates() {
  const [candidates, setCandidates] = useState<DockerCleanupCandidates | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCandidates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await dockerService.getCleanupCandidates();
      setCandidates(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : '정리 후보를 불러오지 못했습니다.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCandidates();
  }, [loadCandidates]);

  return {
    candidates,
    loading,
    error,
    reload: loadCandidates,
  };
}
