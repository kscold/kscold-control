import { useState } from 'react';
import { X } from 'lucide-react';
import {
  WORKTREE_CLEANUP_DEFAULTS,
  type UpdateWorktreeCleanupTargetInput,
  type WorktreeCleanupTargetInput,
  type WorktreeCleanupTargetStatus,
} from '../model/maintenance.types';

interface Props {
  target: WorktreeCleanupTargetStatus | null;
  timeZone: string;
  onClose: () => void;
  onCreate: (input: WorktreeCleanupTargetInput) => Promise<void>;
  onUpdate: (
    id: string,
    input: UpdateWorktreeCleanupTargetInput,
  ) => Promise<void>;
}

const FIELD =
  'w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:text-gray-500';
const HINT = 'text-[11px] leading-4 text-gray-500';

/** 정리 대상 등록·수정 모달 (열려 있을 때만 그린다) */
export function WorktreeCleanupFormModal({
  target,
  timeZone,
  onClose,
  onCreate,
  onUpdate,
}: Props) {
  const isEdit = target !== null;
  const [name, setName] = useState(target?.name ?? '');
  const [description, setDescription] = useState(target?.description ?? '');
  const [rootPath, setRootPath] = useState(target?.rootPath ?? '');
  const [keepRecent, setKeepRecent] = useState(
    String(target?.keepRecent ?? WORKTREE_CLEANUP_DEFAULTS.keepRecent),
  );
  const [protectUnmerged, setProtectUnmerged] = useState(
    target?.protectUnmerged ?? true,
  );
  const [baseRefs, setBaseRefs] = useState(
    (target?.baseRefs ?? WORKTREE_CLEANUP_DEFAULTS.baseRefs).join(', '),
  );
  const [scheduleTime, setScheduleTime] = useState(
    target?.scheduleTime ?? WORKTREE_CLEANUP_DEFAULTS.scheduleTime,
  );
  const [enabled, setEnabled] = useState(target?.enabled ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const keep = Number(keepRecent);
    const refs = baseRefs
      .split(',')
      .map((ref) => ref.trim())
      .filter(Boolean);
    if (!isEdit && !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(name.trim())) {
      return setError(
        '이름은 영문·숫자로 시작하고 영문·숫자·점·밑줄·하이픈만 쓸 수 있습니다.',
      );
    }
    if (!isEdit && !rootPath.trim().startsWith('/')) {
      return setError('정리 루트는 절대 경로로 적어 주세요.');
    }
    if (!Number.isInteger(keep) || keep < 0 || keep > 100) {
      return setError('남길 개수는 0~100 사이로 입력하세요.');
    }
    if (refs.length === 0)
      return setError('기준 브랜치를 하나 이상 적어 주세요.');

    const shared = {
      description: description.trim(),
      keepRecent: keep,
      protectUnmerged,
      baseRefs: refs,
      scheduleTime,
      enabled,
    };
    setSubmitting(true);
    setError(null);
    try {
      if (target) await onUpdate(target.id, shared);
      else
        await onCreate({
          ...shared,
          name: name.trim(),
          rootPath: rootPath.trim(),
        });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="worktree-form-title"
    >
      <div className="flex max-h-full w-full max-w-lg flex-col rounded-xl border border-gray-800 bg-gray-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
          <h2
            id="worktree-form-title"
            className="text-base font-semibold text-white"
          >
            {isEdit ? '정리 대상 수정' : '정리 대상 추가'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4 overflow-y-auto px-5 py-4">
          <div className="space-y-1">
            <label
              htmlFor="wt-name"
              className="text-xs font-medium text-gray-300"
            >
              이름
            </label>
            <input
              id="wt-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isEdit}
              placeholder="예: pawpong-review"
              className={`${FIELD} font-mono`}
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor="wt-description"
              className="text-xs font-medium text-gray-300"
            >
              설명 (선택)
            </label>
            <input
              id="wt-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              className={FIELD}
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor="wt-root"
              className="text-xs font-medium text-gray-300"
            >
              정리 루트
            </label>
            <input
              id="wt-root"
              value={rootPath}
              onChange={(e) => setRootPath(e.target.value)}
              disabled={isEdit}
              placeholder="/Users/kscold/Desktop/pawpong-review/.worktrees"
              className={`${FIELD} font-mono`}
              aria-describedby="wt-root-hint"
            />
            <p id="wt-root-hint" className={HINT}>
              이 디렉터리 바로 아래의 git 작업 폴더(worktree)만 대상입니다. 원본
              저장소·브랜치는 지우지 않습니다.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label
                htmlFor="wt-keep"
                className="text-xs font-medium text-gray-300"
              >
                최근 작업 남길 개수
              </label>
              <input
                id="wt-keep"
                type="number"
                min={0}
                max={100}
                value={keepRecent}
                onChange={(e) => setKeepRecent(e.target.value)}
                className={FIELD}
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="wt-time"
                className="text-xs font-medium text-gray-300"
              >
                매일 실행 시각
              </label>
              <input
                id="wt-time"
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className={FIELD}
                aria-describedby="wt-time-hint"
              />
              <p id="wt-time-hint" className={HINT}>
                {timeZone} 기준
              </p>
            </div>
          </div>
          <div className="space-y-1">
            <label
              htmlFor="wt-refs"
              className="text-xs font-medium text-gray-300"
            >
              기준 브랜치 (쉼표로 구분)
            </label>
            <input
              id="wt-refs"
              value={baseRefs}
              onChange={(e) => setBaseRefs(e.target.value)}
              className={`${FIELD} font-mono`}
              aria-describedby="wt-refs-hint"
            />
            <p id="wt-refs-hint" className={HINT}>
              이 중 하나에 들어간 작업을 "병합됨"으로 봅니다.
            </p>
          </div>
          <div className="flex items-start gap-2.5 rounded-lg border border-gray-800 bg-gray-950/50 px-3 py-2.5">
            <input
              id="wt-protect"
              type="checkbox"
              checked={protectUnmerged}
              onChange={(e) => setProtectUnmerged(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-emerald-500"
            />
            <div>
              <label
                htmlFor="wt-protect"
                className="block text-sm text-gray-200"
              >
                미병합 작업 폴더 남기기
              </label>
              <p className={HINT}>
                끄면 원격에 다 올라가 있는 미병합 작업도 지웁니다. 푸시 안 한
                커밋·변경이 있으면 언제나 남깁니다.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 rounded-lg border border-gray-800 bg-gray-950/50 px-3 py-2.5">
            <input
              id="wt-enabled"
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-emerald-500"
            />
            <label htmlFor="wt-enabled" className="block text-sm text-gray-200">
              매일 자동 정리
            </label>
          </div>
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300"
            >
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {submitting ? '저장 중…' : isEdit ? '저장' : '대상 추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
