import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@/shared/api/api-error';

/** 외부 IP와 매핑 목록은 독립적으로 갱신하며, 늦은 응답은 최신 결과를 덮지 않음. */
export function useNetworkQuery<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  initialValue: T,
) {
  const [data, setData] = useState(initialValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const active = useRef<AbortController | null>(null);

  const reload = async () => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setLoading(true);
    setError('');
    try {
      const result = await loader(controller.signal);
      if (controller.signal.aborted) return;
      setData(result);
      setUpdatedAt(new Date());
    } catch (failure) {
      if (controller.signal.aborted) return;
      setError(
        failure instanceof ApiError &&
          ['ECONNABORTED', 'ETIMEDOUT'].includes(failure.code ?? '')
          ? '응답 대기 시간이 초과됐습니다. 서버와 공유기 연결을 확인한 뒤 다시 시도하세요.'
          : failure instanceof Error
            ? failure.message
            : '네트워크 상태를 확인하지 못했습니다. 다시 시도하세요.',
      );
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    return () => active.current?.abort();
  }, [loader]);

  return { data, loading, error, updatedAt, reload };
}
