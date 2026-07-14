import { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Download,
  History,
  Link2,
  Pin,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Table2,
  Users,
} from 'lucide-react';
import { auditService } from '../api/audit.service';
import { useAuditTimeline } from '../model/useAuditTimeline';
import { buildDiffEntries, buildDiffPreview } from '../lib/audit-diff';
import {
  formatAuditTimestamp,
  formatExportFilename,
} from '@/shared/lib/date-format';
import type { AuditDomain, AuditEvent } from '../model/audit.types';

const DOMAIN_OPTIONS: Array<{ value: AuditDomain; label: string }> = [
  { value: 'all', label: '전체 도메인' },
  { value: 'repository', label: 'Repository' },
  { value: 'docker', label: 'Docker' },
  { value: 'nginx', label: 'Nginx' },
  { value: 'rbac', label: 'RBAC' },
];

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

function getActorLabel(item: {
  actorEmail: string | null;
  actorId: string | null;
}) {
  return item.actorEmail || item.actorId || 'system';
}

function getTargetLabel(item: {
  targetType: string | null;
  targetId: string | null;
}) {
  return `${item.targetType || 'unknown'} / ${item.targetId || '-'}`;
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

function getChangeTone(changeType: 'added' | 'removed' | 'changed') {
  switch (changeType) {
    case 'added':
      return 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100';
    case 'removed':
      return 'border-rose-400/20 bg-rose-500/10 text-rose-100';
    default:
      return 'border-amber-400/20 bg-amber-500/10 text-amber-100';
  }
}

function escapeCsvCell(value: unknown) {
  const normalized =
    typeof value === 'string' ? value : JSON.stringify(value ?? '');
  return `"${normalized.replace(/"/g, '""')}"`;
}

export function AuditTimeline() {
  const {
    actor,
    applyPreset,
    applyTimePreset,
    clearFilters,
    copyShareUrl,
    setActor,
    domain,
    setDomain,
    error,
    from,
    setFrom,
    isLoading,
    items,
    limit,
    presetLabel,
    reload,
    removePreset,
    savedPresets,
    saveCurrentPreset,
    search,
    setLimit,
    setPresetLabel,
    setSearch,
    setTarget,
    summary,
    target,
    togglePresetPin,
    to,
    setTo,
  } = useAuditTimeline();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCopyingUrl, setIsCopyingUrl] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

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
    {
      domain: 'repository',
      label: 'Repository',
      value: summary.byDomain.repository,
    },
    { domain: 'docker', label: 'Docker', value: summary.byDomain.docker },
    { domain: 'nginx', label: 'Nginx', value: summary.byDomain.nginx },
    { domain: 'rbac', label: 'RBAC', value: summary.byDomain.rbac },
  ];
  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  );
  const diffEntries = useMemo(
    () => buildDiffEntries(selectedItem?.metadata ?? {}),
    [selectedItem?.metadata],
  );

  const handleExport = async (format: 'json' | 'csv') => {
    setIsExporting(true);

    try {
      const payload = await auditService.exportEvents({
        actor,
        domain,
        from,
        search,
        target,
        to,
      });
      const blob =
        format === 'json'
          ? new Blob([JSON.stringify(payload, null, 2)], {
              type: 'application/json',
            })
          : new Blob(
              [
                [
                  [
                    ['exportedAt', payload.exportedAt],
                    ['domain', payload.filters.domain ?? 'all'],
                    ['search', payload.filters.search ?? ''],
                    ['actor', payload.filters.actor ?? ''],
                    ['target', payload.filters.target ?? ''],
                    ['from', payload.filters.from ?? ''],
                    ['to', payload.filters.to ?? ''],
                  ]
                    .map(
                      ([key, value]) =>
                        `${escapeCsvCell(key)},${escapeCsvCell(value)}`,
                    )
                    .join('\n'),
                  '',
                  [
                    'id',
                    'domain',
                    'action',
                    'summary',
                    'actorEmail',
                    'actorId',
                    'targetType',
                    'targetId',
                    'createdAt',
                    'metadata',
                  ]
                    .map((value) => escapeCsvCell(value))
                    .join(','),
                  ...payload.items.map((item) =>
                    [
                      item.id,
                      item.domain,
                      item.action,
                      item.summary,
                      item.actorEmail ?? '',
                      item.actorId ?? '',
                      item.targetType ?? '',
                      item.targetId ?? '',
                      item.createdAt,
                      JSON.stringify(item.metadata),
                    ]
                      .map((value) => escapeCsvCell(value))
                      .join(','),
                  ),
                ].join('\n'),
              ],
              { type: 'text/csv;charset=utf-8' },
            );
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download =
        format === 'json'
          ? formatExportFilename(payload.exportedAt, 'json')
          : formatExportFilename(payload.exportedAt, 'csv');
      link.click();
      window.URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyUrl = async () => {
    try {
      const copied = await copyShareUrl();
      if (!copied) {
        return;
      }

      setIsCopyingUrl(true);
      window.setTimeout(() => setIsCopyingUrl(false), 900);
    } catch {
      setIsCopyingUrl(false);
    }
  };

  return (
    <div className="h-full overflow-auto bg-gray-950 p-4 sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-bold text-white sm:text-2xl">
            <ShieldCheck size={22} className="shrink-0 sm:h-7 sm:w-7" />
            운영 감사
          </h1>
          <p className="mt-1 text-xs text-gray-400 sm:text-sm">
            누가 무엇을 실행했는지 타임라인으로 추적합니다.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            onClick={() => void reload()}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-gray-900 px-3 py-2 text-xs text-gray-200 transition hover:border-white/20 hover:text-white disabled:opacity-50 sm:px-4 sm:text-sm"
            aria-label="새로고침"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">새로고침</span>
          </button>

          <button
            type="button"
            onClick={() => void handleExport('json')}
            disabled={isExporting}
            data-testid="audit-export-button"
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100 transition hover:border-cyan-300/30 hover:text-white disabled:opacity-50 sm:px-4 sm:text-sm"
            aria-label="JSON 내보내기"
          >
            <Download
              size={14}
              className={isExporting ? 'animate-bounce' : ''}
            />
            <span className="hidden sm:inline">
              {isExporting ? '내보내는 중' : 'JSON'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => void handleExport('csv')}
            disabled={isExporting}
            data-testid="audit-export-csv-button"
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100 transition hover:border-emerald-300/30 hover:text-white disabled:opacity-50 sm:px-4 sm:text-sm"
            aria-label="CSV 내보내기"
          >
            <Table2 size={14} className={isExporting ? 'animate-pulse' : ''} />
            <span className="hidden sm:inline">
              {isExporting ? '내보내는 중' : 'CSV'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => void handleCopyUrl()}
            data-testid="audit-copy-url-button"
            className="inline-flex items-center gap-2 rounded-xl border border-violet-400/20 bg-violet-500/10 px-3 py-2 text-xs text-violet-100 transition hover:border-violet-300/30 hover:text-white sm:px-4 sm:text-sm"
            aria-label="필터 URL 복사"
          >
            <Link2 size={14} />
            <span className="hidden sm:inline">
              {isCopyingUrl ? 'URL 복사됨' : '필터 URL'}
            </span>
          </button>
        </div>
      </div>

      {/* 모바일 전용: 고급 도구 토글 (필터/프리셋/Top Actors/Targets를 한번에 접고 펼침) */}
      <div className="mb-3 lg:hidden">
        <button
          type="button"
          onClick={() => setToolsOpen((open) => !open)}
          className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-gray-900/70 px-4 py-2.5 text-sm text-gray-300 transition hover:border-white/20 hover:text-white"
        >
          <span className="inline-flex items-center gap-2">
            <SlidersHorizontal size={14} />
            필터 / 통계 도구
          </span>
          {toolsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      <div className={toolsOpen ? 'contents' : 'hidden lg:contents'}>
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
            최근 24시간 {summary.last24Hours}건, 전체 {summary.total}건이 잡혀
            있습니다.
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
            onClick={clearFilters}
            className="rounded-xl border border-white/10 bg-gray-900/70 px-4 py-2 text-sm text-gray-300 transition hover:border-white/20 hover:text-white"
          >
            필터 초기화
          </button>
        </div>

        <div className="mb-4 grid gap-3 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-2xl border border-white/10 bg-gray-900/70 p-4">
            <div className="text-sm font-medium text-white">시간 프리셋</div>
            <div
              className="mt-3 flex flex-wrap gap-2"
              data-testid="audit-time-presets"
            >
              {[
                { label: '최근 1시간', hours: 1 },
                { label: '최근 6시간', hours: 6 },
                { label: '최근 24시간', hours: 24 },
                { label: '최근 7일', hours: 24 * 7 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyTimePreset(preset.hours)}
                  className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-gray-300 transition hover:border-white/20 hover:text-white"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-gray-900/70 p-4">
            <div className="text-sm font-medium text-white">저장 필터</div>
            <div className="mt-3 flex gap-2">
              <input
                value={presetLabel}
                onChange={(event) => setPresetLabel(event.target.value)}
                placeholder="예: 야간 docker 점검"
                className="min-w-0 flex-1 rounded-xl border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={saveCurrentPreset}
                className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-100 transition hover:border-cyan-300/30 hover:text-white"
              >
                저장
              </button>
            </div>
            <div
              className="mt-3 flex flex-wrap gap-2"
              data-testid="audit-saved-presets"
            >
              {savedPresets.length > 0 ? (
                savedPresets.map((preset) => (
                  <div
                    key={preset.id}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 pl-3 pr-2 py-2 text-sm text-gray-200"
                  >
                    <button
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className={`transition hover:text-white ${
                        preset.pinned ? 'font-medium text-white' : ''
                      }`}
                    >
                      {preset.label}
                    </button>
                    <button
                      type="button"
                      onClick={() => togglePresetPin(preset.id)}
                      aria-label={`${preset.label} preset 고정`}
                      className={`rounded-full border px-2 py-0.5 text-xs transition ${
                        preset.pinned
                          ? 'border-amber-300/30 bg-amber-500/10 text-amber-100'
                          : 'border-white/10 text-gray-400 hover:border-white/20 hover:text-white'
                      }`}
                    >
                      <Pin size={11} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removePreset(preset.id)}
                      aria-label={`${preset.label} preset 삭제`}
                      className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-gray-400 transition hover:border-rose-300/30 hover:text-rose-100"
                    >
                      삭제
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-500">
                  아직 저장된 필터가 없습니다.
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-[repeat(5,140px)_minmax(0,1fr)]">
          {summaryCards.map((card) => {
            const active = domain === card.domain;
            return (
              <button
                key={card.domain}
                onClick={() => setDomain(card.domain)}
                className={`rounded-xl border px-3 py-2 text-left transition sm:py-3 ${
                  active
                    ? 'border-blue-500 bg-blue-500/15 text-blue-50'
                    : 'border-white/10 bg-gray-900/70 text-gray-300 hover:border-white/20 hover:text-white'
                }`}
              >
                <div className="truncate text-[10px] uppercase tracking-[0.18em] text-gray-500 sm:text-[11px] sm:tracking-[0.22em]">
                  {card.label}
                </div>
                <div className="mt-1 text-lg font-semibold sm:mt-2 sm:text-xl">
                  {card.value}
                </div>
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

        <section
          className="mb-4 rounded-2xl border border-white/10 bg-gray-900/70 p-4"
          data-testid="audit-top-actors"
        >
          <div className="grid gap-4 xl:grid-cols-2">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-white">
                <Users size={16} />
                Top Actors
              </div>
              <div className="mt-3 grid gap-3">
                {summary.topActors.length > 0 ? (
                  summary.topActors.map((actorEntry) => {
                    const maxCount = summary.topActors[0]?.count ?? 1;
                    const width = Math.max(
                      12,
                      Math.round((actorEntry.count / maxCount) * 100),
                    );

                    return (
                      <button
                        key={actorEntry.key}
                        type="button"
                        onClick={() => setActor(getActorLabel(actorEntry))}
                        className="rounded-xl border border-white/10 bg-black/20 p-3 text-left transition hover:border-white/20"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 text-sm text-white">
                            <div className="truncate font-medium">
                              {getActorLabel(actorEntry)}
                            </div>
                            <div className="mt-1 text-xs text-gray-500">
                              클릭해서 actor 필터 적용
                            </div>
                          </div>
                          <div className="shrink-0 whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-gray-300">
                            {actorEntry.count}건
                          </div>
                        </div>
                        <div className="mt-3 h-2 rounded-full bg-white/5">
                          <div
                            className="h-full rounded-full bg-cyan-400/80"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-6 text-sm text-gray-500">
                    아직 집계할 actor 이벤트가 없습니다.
                  </div>
                )}
              </div>
            </div>

            <div data-testid="audit-top-targets">
              <div className="flex items-center gap-2 text-sm font-medium text-white">
                <History size={16} />
                Top Targets
              </div>
              <div className="mt-3 grid gap-3">
                {summary.topTargets.length > 0 ? (
                  summary.topTargets.map((targetEntry) => {
                    const maxCount = summary.topTargets[0]?.count ?? 1;
                    const width = Math.max(
                      12,
                      Math.round((targetEntry.count / maxCount) * 100),
                    );

                    return (
                      <button
                        key={targetEntry.key}
                        type="button"
                        onClick={() => setTarget(getTargetLabel(targetEntry))}
                        className="rounded-xl border border-white/10 bg-black/20 p-3 text-left transition hover:border-white/20"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 text-sm text-white">
                            <div className="truncate font-medium">
                              {getTargetLabel(targetEntry)}
                            </div>
                            <div className="mt-1 text-xs text-gray-500">
                              클릭해서 target 필터 적용
                            </div>
                          </div>
                          <div className="shrink-0 whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-gray-300">
                            {targetEntry.count}건
                          </div>
                        </div>
                        <div className="mt-3 h-2 rounded-full bg-white/5">
                          <div
                            className="h-full rounded-full bg-amber-400/80"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-6 text-sm text-gray-500">
                    아직 집계할 target 이벤트가 없습니다.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      )}

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 2xl:grid-cols-[minmax(0,1.15fr)_420px]">
        <div className="min-w-0 space-y-3" data-testid="audit-timeline">
          {items.length === 0 && !isLoading ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-gray-900/50 px-6 py-10 text-center text-sm text-gray-500">
              검색 조건에 맞는 감사 이벤트가 없습니다.
            </div>
          ) : (
            items.map((item) => {
              const active = item.id === selectedId;
              const diffPreview =
                item.diffSummary?.preview ?? buildDiffPreview(item.metadata);

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`block w-full overflow-hidden rounded-2xl border p-4 text-left transition ${
                    active
                      ? 'border-blue-500/60 bg-blue-500/10'
                      : 'border-white/10 bg-gray-900/70 hover:border-white/20'
                  }`}
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 flex-col">
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
                      <h2 className="mt-3 break-words text-sm font-semibold text-white sm:text-base">
                        {item.summary}
                      </h2>
                      <div className="mt-2 flex flex-col gap-1 text-xs text-gray-400 sm:flex-row sm:flex-wrap sm:gap-x-4">
                        <div className="flex min-w-0 items-baseline gap-1.5">
                          <span className="shrink-0 text-gray-500">actor</span>
                          <span className="min-w-0 break-all text-gray-300">
                            {getActorLabel(item)}
                          </span>
                        </div>
                        <div className="flex min-w-0 items-baseline gap-1.5">
                          <span className="shrink-0 text-gray-500">target</span>
                          <span className="min-w-0 break-all text-gray-300">
                            {item.targetType || 'unknown'} /{' '}
                            {item.targetId || '-'}
                          </span>
                        </div>
                        <div className="flex min-w-0 items-baseline gap-1.5">
                          <span className="shrink-0 text-gray-500">time</span>
                          <span className="min-w-0 text-gray-300">
                            {formatAuditTimestamp(item.createdAt)}
                          </span>
                        </div>
                      </div>
                      {diffPreview && (
                        <div className="mt-2 break-words text-xs text-cyan-200/90">
                          {diffPreview}
                        </div>
                      )}
                    </div>

                    <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-gray-950/80 px-2.5 py-1 text-[11px] text-gray-400">
                      <History size={12} />
                      <span className="hidden sm:inline">detail</span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <aside
          className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-gray-900/70 p-4"
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
                <h2 className="mt-3 break-words text-base font-semibold text-white sm:text-lg">
                  {selectedItem.summary}
                </h2>
                <div className="mt-3 grid gap-1.5 text-sm">
                  <div className="flex min-w-0 items-baseline gap-2">
                    <span className="shrink-0 text-xs uppercase tracking-[0.18em] text-gray-500">
                      actor
                    </span>
                    <span className="min-w-0 break-all text-gray-200">
                      {getActorLabel(selectedItem)}
                    </span>
                  </div>
                  <div className="flex min-w-0 items-baseline gap-2">
                    <span className="shrink-0 text-xs uppercase tracking-[0.18em] text-gray-500">
                      target
                    </span>
                    <span className="min-w-0 break-all text-gray-200">
                      {selectedItem.targetType || 'unknown'} /{' '}
                      {selectedItem.targetId || '-'}
                    </span>
                  </div>
                  <div className="flex min-w-0 items-baseline gap-2">
                    <span className="shrink-0 text-xs uppercase tracking-[0.18em] text-gray-500">
                      time
                    </span>
                    <span className="min-w-0 text-gray-200">
                      {formatAuditTimestamp(selectedItem.createdAt)}
                    </span>
                  </div>
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
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-xs font-medium text-cyan-100">
                            {entry.path}
                          </div>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] ${getChangeTone(
                              entry.changeType,
                            )}`}
                          >
                            {entry.changeType}
                          </span>
                        </div>
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
              왼쪽 타임라인에서 이벤트를 선택하면 상세 diff와 메타데이터를
              확인할 수 있습니다.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
