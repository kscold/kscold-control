import { useCallback, useEffect, useState } from 'react';
import { auditService } from '../../../services/api/audit.service';
import type { AuditDomain, AuditEvent, AuditSummary } from '../lib/audit.types';

const EMPTY_SUMMARY: AuditSummary = {
  total: 0,
  last24Hours: 0,
  byDomain: {
    repository: 0,
    docker: 0,
    nginx: 0,
    rbac: 0,
  },
};

export function useAuditTimeline() {
  const [domain, setDomain] = useState<AuditDomain>('all');
  const [limit, setLimit] = useState(120);
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<AuditEvent[]>([]);
  const [summary, setSummary] = useState<AuditSummary>(EMPTY_SUMMARY);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [nextItems, nextSummary] = await Promise.all([
        auditService.listEvents({ domain, limit, search }),
        auditService.getSummary({ domain, search }),
      ]);
      setItems(nextItems);
      setSummary(nextSummary);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : '감사 이벤트를 불러오지 못했습니다.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [domain, limit, search]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    domain,
    setDomain,
    limit,
    setLimit,
    search,
    setSearch,
    items,
    summary,
    isLoading,
    error,
    reload: load,
  };
}
