import { CalendarClock, Loader2, RefreshCw } from 'lucide-react';
import { formatShortDateTime } from '@/shared/lib';
import type {
  AutomationHealth,
  AutomationJob,
  AutomationKind,
} from '../model/maintenance.types';
import { useAutomations } from '../model/useAutomations';

const GROUPS: Array<{ kind: AutomationKind; title: string; hint: string }> = [
  {
    kind: 'control',
    title: 'kscold-control 예약 작업',
    hint: 'Control이 직접 돌리고 기록을 남기는 작업',
  },
  {
    kind: 'launchd',
    title: '맥 자동 실행 작업',
    hint: 'macOS launchd에 등록된 작업 — 출력 기록에 아무것도 안 남기는 작업은 마지막 출력 시각이 오래돼 보일 수 있음',
  },
  {
    kind: 'container',
    title: '컨테이너 안 자동 정리',
    hint: '배포할 때마다 컨테이너 안에서 오래된 릴리스를 지우는 작업',
  },
];

const HEALTH: Record<AutomationHealth, { label: string; className: string }> = {
  ok: {
    label: '정상',
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  },
  failed: {
    label: '실패',
    className: 'border-red-500/40 bg-red-500/10 text-red-200',
  },
  stopped: {
    label: '멈춤',
    className: 'border-gray-600 bg-gray-800 text-gray-300',
  },
  running: {
    label: '실행 중',
    className: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
  },
  unknown: {
    label: '기록 없음',
    className: 'border-gray-700 bg-gray-900 text-gray-400',
  },
};

function JobRow({ job }: { job: AutomationJob }) {
  const health = HEALTH[job.health];
  return (
    <li
      className={`px-4 py-3 sm:px-5 ${job.health === 'failed' ? 'bg-red-950/20' : ''}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-100">
              {job.name}
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 text-[11px] ${health.className}`}
            >
              {health.label}
            </span>
          </p>
          <p className="mt-0.5 break-all text-xs text-gray-500">
            {job.description}
          </p>
        </div>
        <span className="shrink-0 rounded-md bg-gray-800 px-2 py-0.5 text-[11px] text-gray-300">
          {job.schedule}
        </span>
      </div>
      <p className="mt-1.5 break-all text-xs text-gray-400">
        {job.lastRunAt
          ? `${job.kind === 'launchd' ? '마지막 출력' : '마지막 실행'} ${formatShortDateTime(job.lastRunAt)}`
          : job.kind === 'launchd'
            ? '출력 기록이 없습니다'
            : '아직 실행 기록이 없습니다'}
        {job.lastMessage && (
          <span className="text-gray-500"> · {job.lastMessage}</span>
        )}
      </p>
    </li>
  );
}

/** 자동 작업 현황 — 정리·점검 작업이 언제 돌았고 잘 끝났는지 한곳에서 본다 */
export function AutomationsView() {
  const { overview, loading, error, reload } = useAutomations();
  const jobs = overview?.jobs ?? [];
  const failed = jobs.filter((job) => job.health === 'failed').length;
  const stopped = jobs.filter((job) => job.health === 'stopped').length;
  const ok = jobs.filter((job) => job.health === 'ok').length;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-3 text-xl font-bold text-white sm:text-2xl">
            <CalendarClock size={24} className="shrink-0 text-violet-400" />
            자동 작업
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
            이 맥에서 자동으로 도는 정리·점검 작업이 언제 돌았고 잘 끝났는지
            봅니다. 1분마다 다시 읽고, 여기서는 아무것도 실행하지 않습니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void reload()}
          disabled={loading}
          className="inline-flex shrink-0 items-center gap-2 self-start rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-gray-300 hover:text-white disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          새로고침
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300"
        >
          {error}
        </div>
      )}

      {!overview ? (
        loading && (
          <div className="flex justify-center py-16">
            <Loader2 size={24} className="animate-spin text-gray-600" />
          </div>
        )
      ) : (
        <div className="space-y-6">
          <p className="text-sm text-gray-300">
            전체 {jobs.length}개 · 정상 {ok}개
            {failed > 0 && (
              <span className="text-red-300"> · 실패 {failed}개</span>
            )}
            {stopped > 0 && (
              <span className="text-gray-400"> · 멈춤 {stopped}개</span>
            )}
          </p>

          {GROUPS.map((group) => {
            const items = jobs.filter((job) => job.kind === group.kind);
            if (items.length === 0) return null;
            return (
              <section
                key={group.kind}
                className="rounded-2xl border border-gray-800 bg-gray-900/70"
              >
                <div className="border-b border-gray-800 px-4 py-3 sm:px-5">
                  <h2 className="text-sm font-semibold text-white">
                    {group.title}
                  </h2>
                  <p className="mt-0.5 text-xs text-gray-500">{group.hint}</p>
                </div>
                <ul className="divide-y divide-gray-800">
                  {items.map((job) => (
                    <JobRow key={job.key} job={job} />
                  ))}
                </ul>
              </section>
            );
          })}

          <section className="rounded-2xl border border-gray-800 bg-gray-900/70">
            <h2 className="border-b border-gray-800 px-4 py-3 text-sm font-semibold text-white sm:px-5">
              공간 반환 기록
            </h2>
            {overview.trimRuns.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-gray-500">
                아직 기록이 없습니다.
              </p>
            ) : (
              <ul className="divide-y divide-gray-800">
                {overview.trimRuns.map((run) => (
                  <li
                    key={run.id}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-xs sm:px-5"
                  >
                    <span className="text-gray-300">
                      {formatShortDateTime(run.startedAt)} ·{' '}
                      {run.trigger === 'schedule'
                        ? '예약'
                        : `버튼${run.actorEmail ? ` (${run.actorEmail})` : ''}`}
                    </span>
                    <span
                      className={
                        run.status === 'failed'
                          ? 'break-all text-red-300'
                          : 'break-all text-gray-400'
                      }
                    >
                      {run.status === 'running' ? '진행 중' : run.message}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {overview.warnings.length > 0 && (
            <section className="rounded-2xl border border-amber-900/50 bg-amber-950/20 px-4 py-3 text-xs text-amber-200">
              <h2 className="font-semibold">일부 작업을 읽지 못했습니다</h2>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {overview.warnings.map((warning) => (
                  <li key={warning} className="break-all">
                    {warning}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
