import { useCallback, useDeferredValue, useEffect, useState } from 'react';
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

function toIsoDateTime(value: string) {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString();
}

export function useAuditTimeline() {
  const [domain, setDomain] = useState<AuditDomain>('all');
  const [limit, setLimit] = useState(120);
  const [actor, setActor] = useState('');
  const [search, setSearch] = useState('');
  const [target, setTarget] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [items, setItems] = useState<AuditEvent[]>([]);
  const [summary, setSummary] = useState<AuditSummary>(EMPTY_SUMMARY);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deferredActor = useDeferredValue(actor);
  const deferredSearch = useDeferredValue(search);
  const deferredTarget = useDeferredValue(target);
  const deferredFrom = useDeferredValue(from);
  const deferredTo = useDeferredValue(to);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [nextItems, nextSummary] = await Promise.all([
        auditService.listEvents({
          actor: deferredActor,
          domain,
          from: toIsoDateTime(deferredFrom),
          limit,
          search: deferredSearch,
          target: deferredTarget,
          to: toIsoDateTime(deferredTo),
        }),
        auditService.getSummary({
          actor: deferredActor,
          domain,
          from: toIsoDateTime(deferredFrom),
          search: deferredSearch,
          target: deferredTarget,
          to: toIsoDateTime(deferredTo),
        }),
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
  }, [deferredActor, deferredFrom, deferredSearch, deferredTarget, deferredTo, domain, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    actor,
    setActor,
    domain,
    setDomain,
    error,
    from,
    setFrom,
    isLoading,
    reload: load,
    items,
    limit,
    search,
    setLimit,
    setSearch,
    setTarget,
    summary,
    target,
    to,
    setTo,
  };
}
