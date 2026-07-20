import { useState, useEffect } from 'react';
import { dockerService } from '@/entities/container';
import type { Container } from '@/entities/container';

/**
 * 컨테이너 목록을 조회하고 그 상태를 관리하는 훅
 */
export function useContainers() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadContainers = async () => {
    try {
      setLoading(true);
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
    // 5초마다 자동 새로고침
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
