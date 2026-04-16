import { useCallback, useEffect, useState } from 'react';
import { auditService } from '../../../services/api/audit.service';
import type { AuditDomain, AuditEvent } from '../lib/audit.types';

export function useAuditTimeline() {
  const [domain, setDomain] = useState<AuditDomain>('all');
  const [limit, setLimit] = useState(120);
  const [items, setItems] = useState<AuditEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const nextItems = await auditService.listEvents({ domain, limit });
      setItems(nextItems);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : '감사 이벤트를 불러오지 못했습니다.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [domain, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    domain,
    setDomain,
    limit,
    setLimit,
    items,
    isLoading,
    error,
    reload: load,
  };
}
