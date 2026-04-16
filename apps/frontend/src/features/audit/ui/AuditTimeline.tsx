import { useEffect, useMemo, useState } from 'react';
import { History, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { useAuditTimeline } from '../hooks/useAuditTimeline';
import type { AuditDomain, AuditEvent } from '../lib/audit.types';

const DOMAIN_OPTIONS: Array<{ value: AuditDomain; label: string }> = [
  { value: 'all', label: '전체 도메인' },
  { value: 'repository', label: 'Repository' },
  { value: 'docker', label: 'Docker' },
  { value: 'nginx', label: 'Nginx' },
  { value: 'rbac', label: 'RBAC' },
];

function formatTimestamp(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getDomainTone(domain: AuditEvent['domain']) {
  switch (domain) {
    case 'repository':
      return 'border-cyan-400/20 bg-cyan-500/10 text-cyan-100';
    case 'docker':
      return 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100';
    case 'nginx':
      return 'border-amber-400/20 bg-amber-500/10 text-amber-100';
    case 'rbac':
      return 'border-violet-400/20 bg-violet-500/10 text-violet-100';
    default:
      return 'border-white/10 bg-white/5 text-slate-200';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) {
    return '-';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value);
}

function flattenRecord(
  value: Record<string, unknown>,
  prefix = '',
  output = new Map<string, unknown>(),
) {
  Object.entries(value).forEach(([key, nestedValue]) => {
    const nextPath = prefix ? `${prefix}.${key}` : key;

    if (isRecord(nestedValue) && Object.keys(nestedValue).length > 0) {
      flattenRecord(nestedValue, nextPath, output);
      return;
    }

    output.set(nextPath, nestedValue);
  });

  return output;
}

function buildDiffEntries(metadata: Record<string, unknown>) {
  const before = isRecord(metadata.before) ? metadata.before : null;
  const after = isRecord(metadata.after) ? metadata.after : null;

  if (!before && !after) {
    return [];
  }

  const beforeMap = before ? flattenRecord(before) : new Map<string, unknown>();
  const afterMap = after ? flattenRecord(after) : new Map<string, unknown>();
  const paths = Array.from(
    new Set([...beforeMap.keys(), ...afterMap.keys()]),
  ).sort((left, right) => left.localeCompare(right));

  return paths
    .map((path) => {
      const beforeValue = beforeMap.get(path);
      const afterValue = afterMap.get(path);

      if (JSON.stringify(beforeValue) === JSON.stringify(afterValue)) {
        return null;
      }

      return {
        path,
        beforeValue,
        afterValue,
      };
    })
    .filter(
      (
        entry,
      ): entry is {
        path: string;
        beforeValue: unknown;
        afterValue: unknown;
      } => Boolean(entry),
    );
}

export function AuditTimeline() {
  const {
    actor,
    setActor,
    domain,
    setDomain,
    error,
    from,
    setFrom,
    isLoading,
    items,
    limit,
    reload,
    search,
    setLimit,
    setSearch,
    setTarget,
    summary,
    target,
    to,
    setTo,
  } = useAuditTimeline();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (items.length === 0) {
      setSelectedId(null);
      return;
    }

    if (!selectedId || !items.some((item) => item.id === selectedId)) {
      setSelectedId(items[0].id);
    }
  }, [items, selectedId]);

  const summaryCards: Array<{
    domain: AuditDomain;
    label: string;
    value: number;
  }> = [
    { domain: 'all', label: '전체 이벤트', value: summary.total },
    { domain: 'repository', label: 'Repository', value: summary.byDomain.repository },
    { domain: 'docker', label: 'Docker', value: summary.byDomain.docker },
    { domain: 'nginx', label: 'Nginx', value: summary.byDomain.nginx },
    { domain: 'rbac', label: 'RBAC', value: summary.byDomain.rbac },
  ];
  const selectedItem = items.find((item) => item.id === selectedId) ?? null;
  const diffEntries = useMemo(
    () => buildDiffEntries(selectedItem?.metadata ?? {}),
    [selectedItem],
  );

  return (
    <div className="h-full overflow-auto bg-gray-950 p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
            <ShieldCheck size={28} />
            운영 감사
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            누가 업로드, Docker 제어, Nginx 리로드, 권한 변경을 실행했는지 타임라인으로
            추적합니다.
          </p>
        </div>

        <button
          onClick={() => void reload()}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-gray-900 px-4 py-2 text-sm text-gray-200 transition hover:border-white/20 hover:text-white disabled:opacity-50"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          새로고침
        </button>
      </div>

      <div className="mb-4 grid gap-3 lg:grid-cols-[220px_180px_minmax(0,1fr)]">
        <select
          value={domain}
          onChange={(event) => setDomain(event.target.value as AuditDomain)}
          className="rounded-xl border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {DOMAIN_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          value={String(limit)}
          onChange={(event) => setLimit(parseInt(event.target.value, 10))}
          className="rounded-xl border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {[50, 120, 200, 300].map((value) => (
            <option key={value} value={value}>
              최근 {value}건
            </option>
          ))}
        </select>

        <div className="rounded-xl border border-white/10 bg-gray-900/70 px-4 py-3 text-sm text-gray-300">
          최근 24시간 {summary.last24Hours}건, 전체 {summary.total}건이 잡혀 있습니다.
        </div>
      </div>

      <div className="mb-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_repeat(2,220px)]">
        <label className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="이벤트, metadata, action 검색"
            className="w-full rounded-xl border border-gray-800 bg-gray-900 py-2 pl-10 pr-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>

        <input
          value={actor}
          onChange={(event) => setActor(event.target.value)}
          placeholder="actor email 또는 id"
          className="w-full rounded-xl border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <input
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          placeholder="target type 또는 id"
          className="w-full rounded-xl border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <button
          type="button"
          onClick={() => {
            setActor('');
            setSearch('');
            setTarget('');
            setFrom('');
            setTo('');
            setDomain('all');
          }}
          className="rounded-xl border border-white/10 bg-gray-900/70 px-4 py-2 text-sm text-gray-300 transition hover:border-white/20 hover:text-white"
        >
          필터 초기화
        </button>
      </div>

      <div className="mb-4 grid gap-3 xl:grid-cols-[repeat(5,140px)_minmax(0,1fr)]">
        {summaryCards.map((card) => {
          const active = domain === card.domain;
          return (
            <button
              key={card.domain}
              onClick={() => setDomain(card.domain)}
              className={`rounded-xl border px-3 py-3 text-left transition ${
                active
                  ? 'border-blue-500 bg-blue-500/15 text-blue-50'
                  : 'border-white/10 bg-gray-900/70 text-gray-300 hover:border-white/20 hover:text-white'
              }`}
            >
              <div className="text-[11px] uppercase tracking-[0.22em] text-gray-500">
                {card.label}
              </div>
              <div className="mt-2 text-xl font-semibold">{card.value}</div>
            </button>
          );
        })}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="rounded-xl border border-white/10 bg-gray-900/70 px-3 py-2 text-xs text-gray-400">
            시작 시각
            <input
              aria-label="감사 시작 시각"
              type="datetime-local"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="mt-2 w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <label className="rounded-xl border border-white/10 bg-gray-900/70 px-3 py-2 text-xs text-gray-400">
            끝 시각
            <input
              aria-label="감사 끝 시각"
              type="datetime-local"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="mt-2 w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      )}

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.15fr)_420px]">
        <div className="space-y-3" data-testid="audit-timeline">
          {items.length === 0 && !isLoading ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-gray-900/50 px-6 py-10 text-center text-sm text-gray-500">
              검색 조건에 맞는 감사 이벤트가 없습니다.
            </div>
          ) : (
            items.map((item) => {
              const active = item.id === selectedId;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`block w-full rounded-2xl border p-4 text-left transition ${
                    active
                      ? 'border-blue-500/60 bg-blue-500/10'
                      : 'border-white/10 bg-gray-900/70 hover:border-white/20'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getDomainTone(
                            item.domain,
                          )}`}
                        >
                          {item.domain}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-gray-300">
                          {item.action}
                        </span>
                      </div>
                      <h2 className="mt-3 text-base font-semibold text-white">
                        {item.summary}
                      </h2>
                      <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-400">
                        <span>actor {item.actorEmail || item.actorId || 'system'}</span>
                        <span>
                          target {item.targetType || 'unknown'} / {item.targetId || '-'}
                        </span>
                        <span>{formatTimestamp(item.createdAt)}</span>
                      </div>
                    </div>

                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-gray-950/80 px-3 py-1.5 text-[11px] text-gray-400">
                      <History size={12} />
                      detail
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <aside
          className="rounded-2xl border border-white/10 bg-gray-900/70 p-4"
          data-testid="audit-detail"
        >
          {selectedItem ? (
            <div className="space-y-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getDomainTone(
                      selectedItem.domain,
                    )}`}
                  >
                    {selectedItem.domain}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-gray-300">
                    {selectedItem.action}
                  </span>
                </div>
                <h2 className="mt-3 text-lg font-semibold text-white">
                  {selectedItem.summary}
                </h2>
                <div className="mt-3 grid gap-2 text-sm text-gray-300">
                  <div>actor: {selectedItem.actorEmail || selectedItem.actorId || 'system'}</div>
                  <div>
                    target: {selectedItem.targetType || 'unknown'} /{' '}
                    {selectedItem.targetId || '-'}
                  </div>
                  <div>time: {formatTimestamp(selectedItem.createdAt)}</div>
                </div>
              </div>

              <section className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="text-[11px] uppercase tracking-[0.22em] text-gray-500">
                  Detail Diff
                </div>

                {diffEntries.length > 0 ? (
                  <div className="mt-3 space-y-3">
                    {diffEntries.map((entry) => (
                      <div
                        key={entry.path}
                        className="rounded-xl border border-white/8 bg-black/20 p-3"
                      >
                        <div className="text-xs font-medium text-cyan-100">{entry.path}</div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <div className="rounded-lg border border-rose-400/20 bg-rose-500/10 p-2">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-rose-200/80">
                              Before
                            </div>
                            <div className="mt-1 break-all text-xs text-rose-50">
                              {formatValue(entry.beforeValue)}
                            </div>
                          </div>
                          <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 p-2">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-200/80">
                              After
                            </div>
                            <div className="mt-1 break-all text-xs text-emerald-50">
                              {formatValue(entry.afterValue)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-gray-500">
                    before/after 메타가 없는 이벤트입니다.
                  </div>
                )}
              </section>

              {Object.keys(selectedItem.metadata ?? {}).length > 0 && (
                <section className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-gray-500">
                    Raw Metadata
                  </div>
                  <pre className="mt-3 overflow-auto rounded-xl border border-white/8 bg-black/30 p-3 text-[11px] leading-5 text-slate-300">
                    {JSON.stringify(selectedItem.metadata, null, 2)}
                  </pre>
                </section>
              )}
            </div>
          ) : (
            <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl border border-dashed border-white/10 bg-black/20 p-6 text-center text-sm text-gray-500">
              왼쪽 타임라인에서 이벤트를 선택하면 상세 diff와 메타데이터를 확인할 수 있습니다.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
