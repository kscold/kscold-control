import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { auditService } from '../../../services/api/audit.service';
import type {
  AuditDomain,
  AuditEvent,
  AuditFilterPreset,
  AuditSummary,
} from '../lib/audit.types';

const CURRENT_FILTER_STORAGE_KEY = 'audit-timeline-current-filter';
const PRESET_STORAGE_KEY = 'audit-timeline-saved-presets';

const EMPTY_SUMMARY: AuditSummary = {
  total: 0,
  last24Hours: 0,
  byDomain: {
    repository: 0,
    docker: 0,
    nginx: 0,
    rbac: 0,
  },
  topActors: [],
  topTargets: [],
};

type StoredAuditFilter = {
  actor?: string;
  domain?: AuditDomain;
  from?: string;
  limit?: number;
  search?: string;
  target?: string;
  to?: string;
};

function isAuditDomain(value: string | null): value is AuditDomain {
  return (
    value === 'all' ||
    value === 'repository' ||
    value === 'docker' ||
    value === 'nginx' ||
    value === 'rbac'
  );
}

function sortPresets(items: AuditFilterPreset[]) {
  return [...items].sort((left, right) => {
    if (left.pinned !== right.pinned) {
      return left.pinned ? -1 : 1;
    }

    return left.label.localeCompare(right.label);
  });
}

function readStoredFilter(): StoredAuditFilter {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(CURRENT_FILTER_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as StoredAuditFilter;
    return parsed ?? {};
  } catch {
    return {};
  }
}

function readUrlFilter(): StoredAuditFilter {
  if (typeof window === 'undefined') {
    return {};
  }

  const params = new URLSearchParams(window.location.search);
  const domain = params.get('domain');
  const limitRaw = params.get('limit');
  const limit = limitRaw ? parseInt(limitRaw, 10) : undefined;

  return {
    actor: params.get('actor') ?? undefined,
    domain: isAuditDomain(domain) ? domain : undefined,
    from: params.get('from') ?? undefined,
    limit: Number.isFinite(limit) ? limit : undefined,
    search: params.get('search') ?? undefined,
    target: params.get('target') ?? undefined,
    to: params.get('to') ?? undefined,
  };
}

function readSavedPresets(): AuditFilterPreset[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(PRESET_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return sortPresets(
      parsed
        .filter(
          (item): item is Partial<AuditFilterPreset> =>
            Boolean(item) &&
            typeof item.id === 'string' &&
            typeof item.label === 'string' &&
            typeof item.domain === 'string',
        )
        .map((item) => ({
          actor: item.actor ?? '',
          domain: isAuditDomain(item.domain ?? null)
            ? (item.domain as AuditDomain)
            : 'all',
          from: item.from ?? '',
          id: item.id!,
          label: item.label!,
          pinned: Boolean(item.pinned),
          search: item.search ?? '',
          target: item.target ?? '',
          to: item.to ?? '',
        })),
    );
  } catch {
    return [];
  }
}

function toDateTimeLocalInput(value: Date) {
  const offset = value.getTimezoneOffset();
  const local = new Date(value.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function replaceAuditUrl(filter: StoredAuditFilter) {
  if (typeof window === 'undefined') {
    return;
  }

  const params = new URLSearchParams();

  if (filter.domain && filter.domain !== 'all') {
    params.set('domain', filter.domain);
  }
  if (filter.actor?.trim()) {
    params.set('actor', filter.actor.trim());
  }
  if (filter.search?.trim()) {
    params.set('search', filter.search.trim());
  }
  if (filter.target?.trim()) {
    params.set('target', filter.target.trim());
  }
  if (filter.from) {
    params.set('from', filter.from);
  }
  if (filter.to) {
    params.set('to', filter.to);
  }
  if (filter.limit && filter.limit !== 120) {
    params.set('limit', String(filter.limit));
  }

  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
  window.history.replaceState({}, '', nextUrl);
}

export function useAuditTimeline() {
  const initialFilter = useMemo(
    () => ({ ...readStoredFilter(), ...readUrlFilter() }),
    [],
  );
  const [domain, setDomain] = useState<AuditDomain>(
    initialFilter.domain ?? 'all',
  );
  const [limit, setLimit] = useState(initialFilter.limit ?? 120);
  const [actor, setActor] = useState(initialFilter.actor ?? '');
  const [search, setSearch] = useState(initialFilter.search ?? '');
  const [target, setTarget] = useState(initialFilter.target ?? '');
  const [from, setFrom] = useState(initialFilter.from ?? '');
  const [to, setTo] = useState(initialFilter.to ?? '');
  const [savedPresets, setSavedPresets] =
    useState<AuditFilterPreset[]>(readSavedPresets);
  const [presetLabel, setPresetLabel] = useState('');
  const [items, setItems] = useState<AuditEvent[]>([]);
  const [summary, setSummary] = useState<AuditSummary>(EMPTY_SUMMARY);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deferredActor = useDeferredValue(actor);
  const deferredSearch = useDeferredValue(search);
  const deferredTarget = useDeferredValue(target);
  const deferredFrom = useDeferredValue(from);
  const deferredTo = useDeferredValue(to);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const currentFilter = {
      actor,
      domain,
      from,
      limit,
      search,
      target,
      to,
    } satisfies StoredAuditFilter;

    window.localStorage.setItem(
      CURRENT_FILTER_STORAGE_KEY,
      JSON.stringify(currentFilter),
    );
    replaceAuditUrl(currentFilter);
  }, [actor, domain, from, limit, search, target, to]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(
      PRESET_STORAGE_KEY,
      JSON.stringify(savedPresets),
    );
  }, [savedPresets]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [nextItems, nextSummary] = await Promise.all([
        auditService.listEvents({
          actor: deferredActor,
          domain,
          from: deferredFrom,
          limit,
          search: deferredSearch,
          target: deferredTarget,
          to: deferredTo,
        }),
        auditService.getSummary({
          actor: deferredActor,
          domain,
          from: deferredFrom,
          search: deferredSearch,
          target: deferredTarget,
          to: deferredTo,
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
  }, [
    deferredActor,
    deferredFrom,
    deferredSearch,
    deferredTarget,
    deferredTo,
    domain,
    limit,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyPreset = useCallback((preset: AuditFilterPreset) => {
    setActor(preset.actor);
    setDomain(preset.domain);
    setFrom(preset.from);
    setSearch(preset.search);
    setTarget(preset.target);
    setTo(preset.to);
  }, []);

  const saveCurrentPreset = useCallback(() => {
    const label = presetLabel.trim();
    if (!label) {
      return;
    }

    setSavedPresets((previous) => {
      const existing = previous.find((item) => item.label === label);
      const nextPreset: AuditFilterPreset = {
        actor,
        domain,
        from,
        id: existing?.id ?? `${Date.now()}`,
        label,
        pinned: existing?.pinned ?? false,
        search,
        target,
        to,
      };

      return sortPresets([
        nextPreset,
        ...previous.filter((item) => item.id !== nextPreset.id),
      ]).slice(0, 8);
    });

    setPresetLabel('');
  }, [actor, domain, from, presetLabel, search, target, to]);

  const removePreset = useCallback((id: string) => {
    setSavedPresets((previous) => previous.filter((item) => item.id !== id));
  }, []);

  const togglePresetPin = useCallback((id: string) => {
    setSavedPresets((previous) =>
      sortPresets(
        previous.map((item) =>
          item.id === id ? { ...item, pinned: !item.pinned } : item,
        ),
      ),
    );
  }, []);

  const applyTimePreset = useCallback((hours: number) => {
    const now = new Date();
    const fromDate = new Date(now.getTime() - hours * 60 * 60 * 1000);

    setFrom(toDateTimeLocalInput(fromDate));
    setTo(toDateTimeLocalInput(now));
  }, []);

  const clearFilters = useCallback(() => {
    setActor('');
    setSearch('');
    setTarget('');
    setFrom('');
    setTo('');
    setDomain('all');
    setLimit(120);
  }, []);

  const copyShareUrl = useCallback(async () => {
    if (typeof window === 'undefined') {
      return false;
    }

    const shareUrl = window.location.href;

    if (window.navigator.clipboard?.writeText) {
      await window.navigator.clipboard.writeText(shareUrl);
      return true;
    }

    const textarea = window.document.createElement('textarea');

    textarea.value = shareUrl;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    window.document.body.appendChild(textarea);
    textarea.select();

    const copied = window.document.execCommand('copy');
    window.document.body.removeChild(textarea);
    return copied;
  }, []);

  return {
    actor,
    applyPreset,
    applyTimePreset,
    clearFilters,
    copyShareUrl,
    domain,
    error,
    from,
    isLoading,
    items,
    limit,
    presetLabel,
    reload: load,
    removePreset,
    savedPresets,
    saveCurrentPreset,
    search,
    setActor,
    setDomain,
    setFrom,
    setLimit,
    setPresetLabel,
    setSearch,
    setTarget,
    setTo,
    summary,
    target,
    togglePresetPin,
    to,
  };
}
