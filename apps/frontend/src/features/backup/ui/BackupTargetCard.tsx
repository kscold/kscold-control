import { useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  Database,
  Loader2,
  Pencil,
  Play,
  Trash2,
  XCircle,
} from 'lucide-react';
import { formatBytes, formatShortDateTime } from '@/shared/lib';
import {
  buildRestoreCommand,
  describeRunOrigin,
  formatRelativeTime,
  formatRunDuration,
} from '../lib/backup-format';
import type { BackupTargetStatus } from '../model/backup.types';

interface BackupTargetCardProps {
  target: BackupTargetStatus;
  now: Date;
  /** 변경·실행 권한이 있는지. 없으면 조회만 한다. */
  canManage: boolean;
  /** 이 대상에 보낸 요청이 아직 끝나지 않았는지 */
  busy: boolean;
  onRun: (target: BackupTargetStatus) => void;
  onEdit: (target: BackupTargetStatus) => void;
  onDelete: (target: BackupTargetStatus) => void;
  onToggleEnabled: (target: BackupTargetStatus) => void;
}

const ENGINE_LABELS: Record<BackupTargetStatus['engine'], string> = {
  mongodb: 'MongoDB',
};

/** 백업 대상 하나의 설정·상태·보관 중인 백업을 보여주는 카드 */
export function BackupTargetCard({
  target,
  now,
  canManage,
  busy,
  onRun,
  onEdit,
  onDelete,
  onToggleEnabled,
}: BackupTargetCardProps) {
  const [archivesOpen, setArchivesOpen] = useState(false);
  const totalBytes = target.archives.reduce(
    (sum, archive) => sum + archive.sizeBytes,
    0,
  );
  const latestArchive = target.archives[0];

  return (
    <article
      className={`rounded-2xl border bg-gray-900/70 ${
        target.enabled ? 'border-gray-800' : 'border-gray-800/60'
      }`}
    >
      <div className="flex flex-col gap-3 p-4 sm:p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Database
              size={18}
              className={target.enabled ? 'text-emerald-400' : 'text-gray-600'}
            />
            <h3 className="font-mono text-base font-semibold text-white">
              {target.name}
            </h3>
            <span className="rounded-full border border-gray-700 bg-gray-800 px-2 py-0.5 text-[11px] text-gray-300">
              {ENGINE_LABELS[target.engine] ?? target.engine}
            </span>
            {target.running ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-200">
                <Loader2 size={11} className="animate-spin" />
                백업 중
              </span>
            ) : (
              <span
                className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                  target.enabled
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                    : 'border-gray-700 bg-gray-800 text-gray-400'
                }`}
              >
                {target.enabled ? '사용 중' : '일시 중지'}
              </span>
            )}
          </div>
          {target.description && (
            <p className="mt-1.5 text-sm text-gray-400">{target.description}</p>
          )}
        </div>

        {canManage && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={target.enabled}
              aria-label={`${target.name} 예약 백업 사용`}
              disabled={busy}
              onClick={() => onToggleEnabled(target)}
              className={`relative h-6 w-11 rounded-full transition disabled:opacity-50 ${
                target.enabled ? 'bg-emerald-600' : 'bg-gray-700'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                  target.enabled ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </button>
            <button
              type="button"
              disabled={busy || target.running}
              onClick={() => onRun(target)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {target.running ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Play size={13} />
              )}
              지금 실행
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onEdit(target)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:border-gray-600 hover:text-white disabled:opacity-50"
            >
              <Pencil size={13} />
              수정
            </button>
            <button
              type="button"
              disabled={busy || target.running}
              onClick={() => onDelete(target)}
              aria-label={`${target.name} 삭제`}
              className="rounded-lg border border-gray-700 p-1.5 text-gray-400 hover:border-red-800 hover:bg-red-950/40 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      <dl className="grid grid-cols-1 gap-px border-y border-gray-800 bg-gray-800 sm:grid-cols-2 xl:grid-cols-4">
        <div className="bg-gray-900 px-4 py-3 sm:px-5">
          <dt className="text-[11px] font-medium text-gray-500">접속 위치</dt>
          <dd
            className="mt-1 truncate font-mono text-xs text-gray-200"
            title={target.connectionSummary}
          >
            {target.connectionSummary}
          </dd>
        </div>
        <div className="bg-gray-900 px-4 py-3 sm:px-5">
          <dt className="text-[11px] font-medium text-gray-500">실행 일정</dt>
          <dd className="mt-1 text-sm text-gray-200">
            매일 {target.scheduleTime}
          </dd>
        </div>
        <div className="bg-gray-900 px-4 py-3 sm:px-5">
          <dt className="text-[11px] font-medium text-gray-500">다음 실행</dt>
          <dd className="mt-1 text-sm text-gray-200">
            {target.nextRunAt ? (
              <>
                {formatShortDateTime(target.nextRunAt)}
                <span className="ml-1.5 text-xs text-gray-500">
                  {formatRelativeTime(target.nextRunAt, now)}
                </span>
              </>
            ) : (
              <span className="text-gray-500">예약 없음</span>
            )}
          </dd>
        </div>
        <div className="bg-gray-900 px-4 py-3 sm:px-5">
          <dt className="text-[11px] font-medium text-gray-500">보관 기간</dt>
          <dd className="mt-1 text-sm text-gray-200">
            {target.retentionDays}일
          </dd>
        </div>
      </dl>

      <div className="px-4 py-3 sm:px-5">
        {target.lastRun ? (
          <div className="flex items-start gap-2 text-xs">
            {target.lastRun.status === 'failed' ? (
              <XCircle size={15} className="mt-0.5 shrink-0 text-red-400" />
            ) : target.lastRun.status === 'running' ? (
              <Loader2
                size={15}
                className="mt-0.5 shrink-0 animate-spin text-sky-400"
              />
            ) : (
              <CheckCircle2
                size={15}
                className="mt-0.5 shrink-0 text-emerald-400"
              />
            )}
            <div className="min-w-0 leading-5">
              <p className="text-gray-300">
                <span className="font-medium text-gray-100">최근 실행</span>
                <span className="mx-1.5 text-gray-600">·</span>
                {formatShortDateTime(target.lastRun.startedAt)}
                <span className="mx-1.5 text-gray-600">·</span>
                {describeRunOrigin(target.lastRun)}
                {target.lastRun.finishedAt && (
                  <>
                    <span className="mx-1.5 text-gray-600">·</span>
                    {formatRunDuration(
                      target.lastRun.startedAt,
                      target.lastRun.finishedAt,
                    )}
                  </>
                )}
                {target.lastRun.archiveSizeBytes !== null && (
                  <>
                    <span className="mx-1.5 text-gray-600">·</span>
                    {formatBytes(target.lastRun.archiveSizeBytes)}
                  </>
                )}
              </p>
              <p
                className={
                  target.lastRun.status === 'failed'
                    ? 'break-words text-red-300'
                    : 'break-words text-gray-500'
                }
              >
                {target.lastRun.status === 'running'
                  ? '백업을 진행하고 있습니다.'
                  : target.lastRun.message}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-500">
            아직 실행한 적이 없습니다.
            {target.enabled && target.nextRunAt
              ? ' 다음 예약 시각에 처음 실행됩니다.'
              : ''}
          </p>
        )}
      </div>

      <div className="border-t border-gray-800">
        <button
          type="button"
          onClick={() => setArchivesOpen((open) => !open)}
          aria-expanded={archivesOpen}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-xs text-gray-400 hover:text-white sm:px-5"
        >
          <span>
            보관 중인 백업{' '}
            <span className="font-medium text-gray-200">
              {target.archives.length}개
            </span>
            {target.archives.length > 0 && (
              <span className="ml-1.5 text-gray-500">
                · {formatBytes(totalBytes)}
              </span>
            )}
          </span>
          <ChevronDown
            size={15}
            className={`shrink-0 transition-transform ${
              archivesOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {archivesOpen && (
          <div className="space-y-3 px-4 pb-4 sm:px-5">
            {target.archives.length === 0 ? (
              <p className="rounded-lg border border-dashed border-gray-800 px-3 py-4 text-center text-xs text-gray-500">
                보관 중인 백업이 없습니다.
              </p>
            ) : (
              <>
                <ul className="divide-y divide-gray-800 rounded-lg border border-gray-800">
                  {target.archives.map((archive) => (
                    <li
                      key={archive.name}
                      className="flex flex-col gap-1 px-3 py-2 text-xs sm:flex-row sm:items-center sm:gap-4"
                    >
                      <span className="w-32 shrink-0 text-gray-200">
                        {formatShortDateTime(archive.takenAt)}
                      </span>
                      <span className="w-20 shrink-0 text-gray-400">
                        {formatBytes(archive.sizeBytes)}
                      </span>
                      <span
                        className="min-w-0 truncate font-mono text-[11px] text-gray-500"
                        title={archive.path}
                      >
                        {archive.path}
                      </span>
                    </li>
                  ))}
                </ul>
                {latestArchive && (
                  <details className="rounded-lg border border-gray-800 bg-gray-950/60 px-3 py-2 text-xs text-gray-400">
                    <summary className="cursor-pointer select-none text-gray-300">
                      복원 방법
                    </summary>
                    <p className="mt-2 leading-5">
                      가장 최근 백업을 되돌리는 명령입니다. 복원할 곳의 접속 URI
                      를 <code className="font-mono">MONGODB_URI</code>{' '}
                      환경변수로 준 뒤 서버에서 실행하세요.
                    </p>
                    <pre className="mt-2 overflow-x-auto rounded-md bg-black/40 p-2 font-mono text-[11px] leading-5 text-gray-300">
                      {buildRestoreCommand(
                        latestArchive.path,
                        target.dumpImage,
                      )}
                    </pre>
                  </details>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
