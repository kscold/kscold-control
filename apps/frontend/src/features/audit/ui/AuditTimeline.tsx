import { History, RefreshCw, ShieldCheck } from 'lucide-react';
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

export function AuditTimeline() {
  const { domain, setDomain, limit, setLimit, items, isLoading, error, reload } =
    useAuditTimeline();

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
          {items.length > 0
            ? `${items.length}건의 이벤트가 보입니다. 운영 변경 흐름을 시간순으로 빠르게 복기할 수 있습니다.`
            : '아직 기록된 감사 이벤트가 없습니다. 업로드나 운영 액션이 발생하면 여기에 쌓입니다.'}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      )}

      <div className="space-y-3" data-testid="audit-timeline">
        {items.length === 0 && !isLoading ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-gray-900/50 px-6 py-10 text-center text-sm text-gray-500">
            감사 이벤트가 아직 없습니다.
          </div>
        ) : (
          items.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-white/10 bg-gray-900/70 p-4"
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
                  timeline
                </div>
              </div>

              {Object.keys(item.metadata ?? {}).length > 0 && (
                <pre className="mt-3 overflow-auto rounded-xl border border-white/8 bg-black/30 p-3 text-[11px] leading-5 text-slate-300">
                  {JSON.stringify(item.metadata, null, 2)}
                </pre>
              )}
            </article>
          ))
        )}
      </div>
    </div>
  );
}
