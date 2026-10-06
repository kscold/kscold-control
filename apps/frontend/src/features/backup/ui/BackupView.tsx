import { useCallback, useEffect, useRef, useState } from 'react';
import { DatabaseBackup, Loader2, Plus, RefreshCw } from 'lucide-react';
import { PERMISSIONS } from '@/shared/config/permissions';
import { formatBytes, usePermissions } from '@/shared/lib';
import { useModalStore } from '@/shared/model';
import { useBackupManagement } from '../model/useBackupManagement';
import type {
  BackupTargetStatus,
  CreateBackupTargetInput,
  UpdateBackupTargetInput,
} from '../model/backup.types';
import { BackupRunHistory } from './BackupRunHistory';
import { BackupSummary } from './BackupSummary';
import { BackupTargetCard } from './BackupTargetCard';
import { BackupTargetFormModal } from './BackupTargetFormModal';

type Notice = { tone: 'success' | 'error' | 'info'; message: string };

const NOTICE_CLASS: Record<Notice['tone'], string> = {
  success: 'border-emerald-900/50 bg-emerald-950/30 text-emerald-200',
  error: 'border-red-900/50 bg-red-950/30 text-red-300',
  info: 'border-sky-900/50 bg-sky-950/30 text-sky-200',
};

const NOTICE_DURATION_MS = 6_000;

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** 백업 관리 화면 — 대상 목록, 등록·수정·삭제, 수동 실행, 실행 이력 */
export function BackupView() {
  const { hasPermission } = usePermissions();
  const { showConfirm } = useModalStore();
  const canManage = hasPermission(PERMISSIONS.BACKUP_MANAGE);

  const [notice, setNotice] = useState<Notice | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BackupTargetStatus | null>(null);
  const [busyTargetId, setBusyTargetId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const noticeTimerRef = useRef<number | null>(null);

  const notify = useCallback((next: Notice) => {
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current);
    }
    setNotice(next);
    noticeTimerRef.current = window.setTimeout(
      () => setNotice(null),
      NOTICE_DURATION_MS,
    );
  }, []);

  useEffect(
    () => () => {
      if (noticeTimerRef.current !== null) {
        window.clearTimeout(noticeTimerRef.current);
      }
    },
    [],
  );

  const handleRunFinished = useCallback(
    (target: BackupTargetStatus) => {
      const run = target.lastRun;
      if (!run) return;
      notify(
        run.status === 'failed'
          ? { tone: 'error', message: `${target.name}: ${run.message}` }
          : {
              tone: 'success',
              message: `${target.name} 백업을 완료했습니다${
                run.archiveSizeBytes !== null
                  ? ` (${formatBytes(run.archiveSizeBytes)})`
                  : ''
              }.`,
            },
      );
    },
    [notify],
  );

  const {
    overview,
    runs,
    runFilter,
    setRunFilter,
    loading,
    error,
    refresh,
    createTarget,
    updateTarget,
    removeTarget,
    runTarget,
  } = useBackupManagement({ onRunFinished: handleRunFinished });

  // "3시간 뒤" 같은 상대 시각 표시는 새 응답이 올 때마다 다시 계산한다.
  useEffect(() => {
    setNow(new Date());
  }, [overview]);

  const items = overview?.items ?? [];
  const timeZone = overview?.timeZone ?? 'Asia/Seoul';

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (target: BackupTargetStatus) => {
    setEditing(target);
    setFormOpen(true);
  };

  /** 대상 하나에 대한 요청을 보내는 동안 그 카드의 버튼을 잠근다. */
  const withBusyTarget = async (
    target: BackupTargetStatus,
    action: () => Promise<void>,
  ) => {
    setBusyTargetId(target.id);
    try {
      await action();
    } catch (caught) {
      notify({ tone: 'error', message: toMessage(caught) });
    } finally {
      setBusyTargetId(null);
    }
  };

  const handleRun = (target: BackupTargetStatus) =>
    withBusyTarget(target, async () => {
      await runTarget(target.id);
      notify({
        tone: 'info',
        message: `${target.name} 백업을 시작했습니다. 끝나면 결과를 알려드립니다.`,
      });
    });

  const handleToggleEnabled = (target: BackupTargetStatus) =>
    withBusyTarget(target, async () => {
      await updateTarget(target.id, { enabled: !target.enabled });
      notify({
        tone: 'info',
        message: target.enabled
          ? `${target.name} 예약 백업을 일시 중지했습니다.`
          : `${target.name} 예약 백업을 다시 켰습니다.`,
      });
    });

  const handleDelete = (target: BackupTargetStatus) => {
    showConfirm(
      `${target.name} 대상을 삭제할까요?\n\n설정과 실행 이력이 지워지고 예약 백업이 멈춥니다.\n이미 만든 백업 파일 ${target.archives.length}개는 서버에 그대로 남습니다.`,
      () => {
        void withBusyTarget(target, async () => {
          await removeTarget(target.id);
          notify({
            tone: 'info',
            message: `${target.name} 대상을 삭제했습니다.`,
          });
        });
      },
      '백업 대상 삭제',
    );
  };

  const handleCreate = async (input: CreateBackupTargetInput) => {
    await createTarget(input);
    notify({
      tone: 'success',
      message: `${input.name} 대상을 등록했습니다. 다음 예약 시각부터 백업합니다.`,
    });
  };

  const handleUpdate = async (id: string, input: UpdateBackupTargetInput) => {
    const target = await updateTarget(id, input);
    notify({ tone: 'success', message: `${target.name} 설정을 저장했습니다.` });
  };

  return (
    <div className="h-full overflow-auto bg-gray-950 p-4 sm:p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-3 text-xl font-bold text-white sm:text-2xl">
            <DatabaseBackup
              size={24}
              className="shrink-0 text-emerald-400 sm:h-7 sm:w-7"
            />
            백업 관리
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
            외부 데이터베이스를 매일 정해진 시각에 덤프하고, 보관 기간이 지난
            백업을 자동으로 정리합니다. 실행 시각은 {timeZone} 기준입니다.
          </p>
        </div>

        <div className="flex shrink-0 gap-2 self-start">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-gray-300 hover:border-gray-700 hover:text-white disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            새로고침
          </button>
          {canManage && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
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
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-gray-600" />
        </div>
      ) : overview ? (
        <div className="space-y-6">
          <BackupSummary items={items} now={now} />

          <section>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">
              백업 대상 ({items.length})
            </h2>
            {items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-800 bg-gray-900/30 p-10 text-center">
                <DatabaseBackup size={32} className="mx-auto text-gray-700" />
                <p className="mt-3 text-sm text-gray-400">
                  {canManage
                    ? '등록된 백업 대상이 없습니다.'
                    : '볼 수 있는 백업 대상이 없습니다.'}
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  {canManage
                    ? '대상을 추가하면 매일 정해진 시각에 자동으로 백업합니다.'
                    : '관리자가 열람 범위에 넣어 준 대상만 여기에 보입니다.'}
                </p>
                {canManage && (
                  <button
                    type="button"
                    onClick={openCreate}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                  >
                    <Plus size={16} />첫 대상 추가
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((target) => (
                  <BackupTargetCard
                    key={target.id}
                    target={target}
                    now={now}
                    canManage={canManage}
                    busy={busyTargetId === target.id}
                    onRun={(item) => void handleRun(item)}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                    onToggleEnabled={(item) => void handleToggleEnabled(item)}
                  />
                ))}
              </div>
            )}
          </section>

          <BackupRunHistory
            runs={runs}
            targets={items}
            filter={runFilter}
            onFilterChange={setRunFilter}
          />
        </div>
      ) : null}

      {formOpen && (
        <BackupTargetFormModal
          target={editing}
          timeZone={timeZone}
          onClose={() => setFormOpen(false)}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  );
}
