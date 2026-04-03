import { useCallback, useEffect, useState } from 'react';
import { dockerService } from '../../../services/api/docker.service';
import type { TopologySnapshot } from '../lib/topology.types';

export function useTopologySnapshot() {
  const [snapshot, setSnapshot] = useState<TopologySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSnapshot = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await dockerService.getTopologySnapshot();
      setSnapshot(data);
    } catch (loadError) {
      console.error(loadError);
      setError('토폴로지 스냅샷을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  return {
    snapshot,
    loading,
    error,
    reload: loadSnapshot,
  };
}
