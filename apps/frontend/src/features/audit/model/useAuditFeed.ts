import { useCallback, useEffect, useRef, useState } from 'react';
import { auditService } from '../api/audit.service';
import { periodStart } from '../lib/audit-feed-format';
import type {
  AuditDomain,
  AuditFeed,
  AuditFeedPeriod,
  AuditFeedView,
} from './audit.types';

const PAGE_SIZE = 60;
const SEARCH_DELAY_MS = 300;

/** 감사 화면 상태: 보기·기간·분류·검색과 더 보기 */
export function useAuditFeed() {
  const [view, setView] = useState<AuditFeedView>('human');
  const [period, setPeriod] = useState<AuditFeedPeriod>('week');
  const [domain, setDomain] = useState<AuditDomain | 'all'>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [feed, setFeed] = useState<AuditFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  // 입력이 멈춘 뒤에만 검색해 글자마다 요청하지 않는다.
  useEffect(() => {
    const timer = window.setTimeout(
      () => setSearch(searchInput.trim()),
      SEARCH_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // 조건이 바뀌면 처음 페이지부터 다시 본다.
  useEffect(() => {
    setLimit(PAGE_SIZE);
  }, [view, period, domain, search]);

  const load = useCallback(async () => {
    const current = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const next = await auditService.getFeed({
        view,
        domain: domain === 'all' ? undefined : domain,
        search,
        from: periodStart(period),
        limit,
      });
      if (current === requestId.current) setFeed(next);
    } catch {
      if (current === requestId.current) {
        setError('기록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      if (current === requestId.current) setLoading(false);
    }
  }, [view, period, domain, search, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    view,
    setView,
    period,
    setPeriod,
    domain,
    setDomain,
    searchInput,
    setSearchInput,
    search,
    feed,
    loading,
    error,
    reload: load,
    loadMore: () => setLimit((value) => value + PAGE_SIZE),
    exportFilters: {
      domain: domain === 'all' ? undefined : domain,
      search,
      from: periodStart(period),
    },
  };
}
