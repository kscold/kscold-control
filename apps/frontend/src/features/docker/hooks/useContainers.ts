import { useState, useEffect } from 'react';
import { dockerService } from '../../../services/api/docker.service';
import type { Container } from '../../../types/domain.types';

/**
 * useContainers Hook
 * Fetches and manages container list state
 */
export function useContainers() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadContainers = async () => {
    try {
      setError(null);
      const data = await dockerService.listContainers();
      setContainers(data);
    } catch (err) {
      console.error('Failed to load containers:', err);
      setError('컨테이너 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContainers();
    // Auto-refresh every 5 seconds
    const interval = setInterval(loadContainers, 5000);
    return () => clearInterval(interval);
  }, []);

  return {
    containers,
    loading,
    error,
    reload: loadContainers,
  };
}
