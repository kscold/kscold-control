import { useCallback, useDeferredValue, useEffect, useState } from 'react';
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
  search?: string;
  target?: string;
  to?: string;
};

function readCurrentFilter(): StoredAuditFilter {
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

    return parsed.filter(
      (item): item is AuditFilterPreset =>
        Boolean(item) &&
        typeof item.id === 'string' &&
        typeof item.label === 'string' &&
        typeof item.domain === 'string',
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

export function useAuditTimeline() {
  const initialFilter = readCurrentFilter();
  const [domain, setDomain] = useState<AuditDomain>(initialFilter.domain ?? 'all');
  const [limit, setLimit] = useState(120);
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

    window.localStorage.setItem(
      CURRENT_FILTER_STORAGE_KEY,
      JSON.stringify({
        actor,
        domain,
        from,
        search,
        target,
        to,
      } satisfies StoredAuditFilter),
    );
  }, [actor, domain, from, search, target, to]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(savedPresets));
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

    const nextPreset: AuditFilterPreset = {
      id: `${Date.now()}`,
      label,
      actor,
      domain,
      from,
      search,
      target,
      to,
    };

    setSavedPresets((previous) =>
      [nextPreset, ...previous.filter((item) => item.label !== label)].slice(0, 8),
    );
    setPresetLabel('');
  }, [actor, domain, from, presetLabel, search, target, to]);

  const removePreset = useCallback((id: string) => {
    setSavedPresets((previous) => previous.filter((item) => item.id !== id));
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
  }, []);

  return {
    actor,
    applyPreset,
    applyTimePreset,
    clearFilters,
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
    to,
  };
}
