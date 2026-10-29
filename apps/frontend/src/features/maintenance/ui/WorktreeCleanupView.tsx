import { useCallback, useState } from 'react';
import {
  Eye,
  FolderX,
  Loader2,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { PERMISSIONS } from '@/shared/config/permissions';
import { formatShortDateTime, usePermissions } from '@/shared/lib';
import { useModalStore } from '@/shared/model';
import { worktreeCleanupService } from '../api/worktree-cleanup.service';
import { formatSize } from '../lib/format';
import { useWorktreeCleanup } from '../model/useWorktreeCleanup';
import type {
  WorktreeCleanupPreview,
  WorktreeCleanupTargetStatus,
} from '../model/maintenance.types';
import { WorktreeCleanupFormModal } from './WorktreeCleanupFormModal';
import { WorktreePreviewTable } from './WorktreePreviewTable';

type Notice = { tone: 'success' | 'error' | 'info'; message: string };
const NOTICE_CLASS: Record<Notice['tone'], string> = {
  success: 'border-emerald-900/50 bg-emerald-950/30 text-emerald-200',
  error: 'border-red-900/50 bg-red-950/30 text-red-300',
  info: 'border-sky-900/50 bg-sky-950/30 text-sky-200',
};

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** 작업 폴더 정리 화면 — 대상, 미리보기, 지금 정리, 이력 */
export function WorktreeCleanupView() {
  const { hasPermission } = usePermissions();
  const { showConfirm } = useModalStore();
  const canManage = hasPermission(PERMISSIONS.SYSTEM_WRITE);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [formTarget, setFormTarget] = useState<
    WorktreeCleanupTargetStatus | null | undefined
  >(undefined);
  const [previews, setPreviews] = useState<
    Record<string, WorktreeCleanupPreview>
  >({});
  const [busy, setBusy] = useState<string | null>(null);

  const onRunFinished = useCallback((target: WorktreeCleanupTargetStatus) => {
    const run = target.lastRun;
    if (!run) return;
    setNotice({
      tone: run.status === 'failed' ? 'error' : 'success',
      message: `${target.name}: ${run.message}`,
    });
    setPreviews((current) => {
      const next = { ...current };
      delete next[target.id];
      return next;
    });
  }, []);
  const { overview, runs, loading, error, refresh, markRunning } =
    useWorktreeCleanup({ onRunFinished });
  const items = overview?.items ?? [];
  const timeZone = overview?.timeZone ?? 'Asia/Seoul';

  const withBusy = async (id: string, action: () => Promise<void>) => {
    setBusy(id);
    try {
      await action();
    } catch (caught) {
      setNotice({ tone: 'error', message: toMessage(caught) });
    } finally {
      setBusy(null);
    }
  };

  const handlePreview = (target: WorktreeCleanupTargetStatus) =>
    withBusy(target.id, async () => {
      const preview = await worktreeCleanupService.preview(target.id);
      setPreviews((current) => ({ ...current, [target.id]: preview }));
    });

  const handleRun = (target: WorktreeCleanupTargetStatus) => {
    const preview = previews[target.id];
    const removable =
      preview?.items.filter((item) => item.action === 'remove') ?? [];
    const summary = preview
      ? `미리보기 기준 ${removable.length}개 폴더(${formatSize(removable.reduce((s, i) => s + i.sizeBytes, 0))})를 지웁니다.`
      : '실행할 때 다시 살펴보고 지워도 되는 폴더만 지웁니다.';
    showConfirm(
      `${target.name} 작업 폴더를 지금 정리할까요?\n\n${summary}\n지우기 직전에 다시 확인하고, .env 같은 로컬 파일과 복원 방법은 백업으로 남깁니다.`,
      () => {
        void withBusy(target.id, async () => {
          await worktreeCleanupService.run(target.id);
          markRunning(target.id);
          setNotice({
            tone: 'info',
            message: `${target.name} 정리를 시작했습니다. 끝나면 결과를 알려드립니다.`,
          });
          await refresh({ silent: true });
        });
      },
      '작업 폴더 정리',
    );
  };

  const handleDelete = (target: WorktreeCleanupTargetStatus) =>
    showConfirm(
      `${target.name} 정리 대상을 삭제할까요?\n설정과 이력만 지워지고 작업 폴더와 백업은 그대로 남습니다.`,
      () => {
        void withBusy(target.id, async () => {
          await worktreeCleanupService.removeTarget(target.id);
          await refresh({ silent: true });
        });
      },
      '정리 대상 삭제',
    );

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-3 text-xl font-bold text-white sm:text-2xl">
            <FolderX size={24} className="shrink-0 text-amber-400" />
            작업 폴더 정리
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
            끝난 git 작업 폴더(worktree)를 매일 정리해 디스크를 되찾습니다. 최근
            작업, 실행 중인 폴더, 커밋·푸시 안 한 변경이 있는 폴더는 남깁니다.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-gray-300 hover:text-white disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            새로고침
          </button>
          {canManage && (
            <button
              type="button"
              onClick={() => setFormTarget(null)}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            >
              <Plus size={16} />
              대상 추가
            </button>
          )}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300"
        >
          {error}
        </div>
      )}
      {notice && (
        <div
          role="status"
          className={`mb-4 rounded-lg border px-4 py-3 text-sm ${NOTICE_CLASS[notice.tone]}`}
        >
          {notice.message}
        </div>
      )}

      {!overview && loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin text-gray-600" />
        </div>
      ) : (
        <div className="space-y-4">
          {items.length === 0 && (
            <div className="rounded-2xl border border-dashed border-gray-800 bg-gray-900/30 p-10 text-center text-sm text-gray-400">
              등록된 정리 대상이 없습니다.
            </div>
          )}
          {items.map((target) => (
            <article
              key={target.id}
              className="rounded-2xl border border-gray-800 bg-gray-900/70"
            >
              <div className="flex flex-col gap-3 p-4 sm:p-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-mono text-base font-semibold text-white">
                      {target.name}
                    </h3>
                    {target.running ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-200">
                        <Loader2 size={11} className="animate-spin" />
                        정리 중
                      </span>
                    ) : (
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] ${target.enabled ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-gray-700 bg-gray-800 text-gray-400'}`}
                      >
                        {target.enabled ? '자동 정리 사용' : '일시 중지'}
                      </span>
                    )}
                  </div>
                  {target.description && (
                    <p className="mt-1 text-sm text-gray-400">
                      {target.description}
                    </p>
                  )}
                  <p className="mt-1 break-all font-mono text-xs text-gray-500">
                    {target.rootPath}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handlePreview(target)}
                    disabled={busy === target.id || target.running}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:text-white disabled:opacity-50"
                  >
                    {busy === target.id && !previews[target.id] ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Eye size={13} />
                    )}
                    미리보기
                  </button>
                  {canManage && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleRun(target)}
                        disabled={busy === target.id || target.running}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50"
                      >
                        <Play size={13} />
                        지금 정리
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormTarget(target)}
                        disabled={busy === target.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:text-white disabled:opacity-50"
                      >
                        <Pencil size={13} />
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(target)}
                        disabled={busy === target.id || target.running}
                        aria-label={`${target.name} 삭제`}
                        className="rounded-lg border border-gray-700 p-1.5 text-gray-400 hover:text-red-300 disabled:opacity-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-px border-y border-gray-800 bg-gray-800 xl:grid-cols-4">
                <div className="bg-gray-900 px-4 py-3">
                  <dt className="text-[11px] text-gray-500">실행 일정</dt>
                  <dd className="mt-1 text-sm text-gray-200">
                    매일 {target.scheduleTime}
                  </dd>
                </div>
                <div className="bg-gray-900 px-4 py-3">
                  <dt className="text-[11px] text-gray-500">다음 실행</dt>
                  <dd className="mt-1 text-sm text-gray-200">
                    {formatShortDateTime(target.nextRunAt, '예약 없음')}
                  </dd>
                </div>
                <div className="bg-gray-900 px-4 py-3">
                  <dt className="text-[11px] text-gray-500">남기는 기준</dt>
                  <dd className="mt-1 text-sm text-gray-200">
                    최근 {target.keepRecent}개
                    {target.protectUnmerged ? ' + 미병합' : ''}
                  </dd>
                </div>
                <div className="bg-gray-900 px-4 py-3">
                  <dt className="text-[11px] text-gray-500">기준 브랜치</dt>
                  <dd className="mt-1 break-all font-mono text-xs text-gray-200">
                    {target.baseRefs.join(', ')}
                  </dd>
                </div>
              </dl>
              <div className="space-y-3 px-4 py-3 sm:px-5">
                <p className="text-xs text-gray-400">
                  {target.lastRun ? (
                    <>
                      최근 실행 {formatShortDateTime(target.lastRun.startedAt)}{' '}
                      ·{' '}
                      {target.lastRun.trigger === 'schedule' ? '예약' : '수동'}{' '}
                      ·{' '}
                      <span
                        className={
                          target.lastRun.status === 'failed'
                            ? 'text-red-300'
                            : 'text-gray-300'
                        }
                      >
                        {target.lastRun.status === 'running'
                          ? '정리 중'
                          : target.lastRun.message}
                      </span>
                    </>
                  ) : (
                    '아직 실행한 적이 없습니다. 먼저 미리보기로 무엇이 지워지는지 확인해 보세요.'
                  )}
                </p>
                {previews[target.id] && (
                  <WorktreePreviewTable preview={previews[target.id]} />
                )}
              </div>
            </article>
          ))}

          <section className="rounded-2xl border border-gray-800 bg-gray-900/70">
            <h2 className="border-b border-gray-800 px-5 py-3 text-sm font-semibold text-white">
              실행 이력
            </h2>
            {runs.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-gray-500">
                아직 실행 기록이 없습니다.
              </p>
            ) : (
              <ul className="divide-y divide-gray-800/70">
                {runs.map((run) => (
                  <li key={run.id} className="px-5 py-3 text-xs text-gray-400">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-gray-300">
                        {formatShortDateTime(run.startedAt)}
                      </span>
                      <span className="font-mono text-white">
                        {run.targetName ?? '-'}
                      </span>
                      <span>
                        {run.trigger === 'schedule'
                          ? '예약'
                          : `수동${run.actorEmail ? ` · ${run.actorEmail}` : ''}`}
                      </span>
                      <span
                        className={
                          run.status === 'failed'
                            ? 'text-red-300'
                            : run.status === 'running'
                              ? 'text-sky-300'
                              : 'text-emerald-300'
                        }
                      >
                        {run.status === 'failed'
                          ? '실패'
                          : run.status === 'running'
                            ? '정리 중'
                            : `${run.removed.length}개 정리 · ${run.diskReclaimedBytes !== null ? `여유 공간 +${formatSize(run.diskReclaimedBytes)}` : `폴더 합 ${formatSize(run.freedBytes)}`}`}
                      </span>
                    </div>
                    <p className="mt-1 leading-5">{run.message}</p>
                    {run.removed.length > 0 && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-gray-300">
                          지운 폴더와 백업 위치
                        </summary>
                        <ul className="mt-1 space-y-0.5 font-mono text-[11px]">
                          {run.removed.map((item) => (
                            <li key={item.name}>
                              {item.name} (
                              {item.branch ?? item.headSha.slice(0, 8)},{' '}
                              {formatSize(item.sizeBytes)}) → {item.backupPath}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {formTarget !== undefined && (
        <WorktreeCleanupFormModal
          target={formTarget}
          timeZone={timeZone}
          onClose={() => setFormTarget(undefined)}
          onCreate={async (input) => {
            await worktreeCleanupService.createTarget(input);
            setNotice({
              tone: 'success',
              message: `${input.name} 정리 대상을 등록했습니다.`,
            });
            await refresh({ silent: true });
          }}
          onUpdate={async (id, input) => {
            const target = await worktreeCleanupService.updateTarget(id, input);
            setNotice({
              tone: 'success',
              message: `${target.name} 설정을 저장했습니다.`,
            });
            await refresh({ silent: true });
          }}
        />
      )}
    </div>
  );
}
