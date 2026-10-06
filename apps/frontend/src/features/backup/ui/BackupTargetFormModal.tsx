import { useState } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';
import {
  BACKUP_TARGET_DEFAULTS,
  BACKUP_TARGET_NAME_PATTERN,
  MAX_BACKUP_RETENTION_DAYS,
  type BackupTargetStatus,
  type CreateBackupTargetInput,
  type UpdateBackupTargetInput,
} from '../model/backup.types';

interface BackupTargetFormModalProps {
  /** 수정할 대상. 없으면 새로 등록한다. */
  target: BackupTargetStatus | null;
  timeZone: string;
  onClose: () => void;
  onCreate: (input: CreateBackupTargetInput) => Promise<void>;
  onUpdate: (id: string, input: UpdateBackupTargetInput) => Promise<void>;
}

interface FormState {
  name: string;
  description: string;
  uri: string;
  scheduleTime: string;
  retentionDays: string;
  dumpImage: string;
  enabled: boolean;
}

function initialState(target: BackupTargetStatus | null): FormState {
  return {
    name: target?.name ?? '',
    description: target?.description ?? '',
    // 저장된 접속 URI 는 서버가 내려주지 않으므로 늘 빈 칸에서 시작한다.
    uri: '',
    scheduleTime: target?.scheduleTime ?? BACKUP_TARGET_DEFAULTS.scheduleTime,
    retentionDays: String(
      target?.retentionDays ?? BACKUP_TARGET_DEFAULTS.retentionDays,
    ),
    dumpImage: target?.dumpImage ?? BACKUP_TARGET_DEFAULTS.dumpImage,
    enabled: target?.enabled ?? true,
  };
}

interface FieldProps {
  id: string;
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * 라벨·입력·도움말 한 묶음.
 * 도움말을 라벨 안에 넣으면 화면 낭독기가 항목 이름으로 함께 읽으므로 따로 두고 연결한다.
 */
function Field({ id, label, hint, children }: FieldProps) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className={HINT_CLASS}>
          {hint}
        </p>
      )}
    </div>
  );
}

const FIELD_CLASS =
  'w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:text-gray-500';
const LABEL_CLASS = 'text-xs font-medium text-gray-300';
const HINT_CLASS = 'text-[11px] leading-4 text-gray-500';

/**
 * 백업 대상 등록·수정 모달
 *
 * 열려 있을 때만 그린다(부모가 조건부로 렌더링). 닫으면 컴포넌트가 사라지므로
 * 입력하던 접속 URI 가 메모리에 남지 않고, 다시 열면 늘 깨끗한 상태에서 시작한다.
 */
export function BackupTargetFormModal({
  target,
  timeZone,
  onClose,
  onCreate,
  onUpdate,
}: BackupTargetFormModalProps) {
  const isEdit = target !== null;
  const [form, setForm] = useState<FormState>(() => initialState(target));
  const [showUri, setShowUri] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = <Key extends keyof FormState>(
    key: Key,
    value: FormState[Key],
  ) => setForm((current) => ({ ...current, [key]: value }));

  const validate = (): string | null => {
    const name = form.name.trim();
    const uri = form.uri.trim();
    const retentionDays = Number(form.retentionDays);

    if (!isEdit && !BACKUP_TARGET_NAME_PATTERN.test(name)) {
      return '이름은 영문·숫자로 시작하고 영문·숫자·점·밑줄·하이픈만 64자까지 쓸 수 있습니다.';
    }
    if (!isEdit && !uri) {
      return '접속 URI 를 입력하세요.';
    }
    if (uri && !/^mongodb(\+srv)?:\/\//.test(uri)) {
      return '접속 URI 는 mongodb:// 또는 mongodb+srv:// 로 시작해야 합니다.';
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.scheduleTime)) {
      return '실행 시각을 선택하세요.';
    }
    if (
      !Number.isInteger(retentionDays) ||
      retentionDays < 1 ||
      retentionDays > MAX_BACKUP_RETENTION_DAYS
    ) {
      return `보관 기간은 1일부터 ${MAX_BACKUP_RETENTION_DAYS}일 사이로 입력하세요.`;
    }
    if (!form.dumpImage.trim()) {
      return '덤프 이미지를 입력하세요.';
    }
    return null;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const invalid = validate();
    if (invalid) {
      setError(invalid);
      return;
    }

    const shared = {
      description: form.description.trim(),
      retentionDays: Number(form.retentionDays),
      scheduleTime: form.scheduleTime,
      dumpImage: form.dumpImage.trim(),
      enabled: form.enabled,
    };
    const uri = form.uri.trim();

    setSubmitting(true);
    setError(null);
    try {
      if (target) {
        // 접속 URI 는 새로 입력했을 때만 보낸다. 비워 두면 저장된 값을 그대로 쓴다.
        await onUpdate(target.id, uri ? { ...shared, uri } : shared);
      } else {
        await onCreate({ ...shared, name: form.name.trim(), uri });
      }
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
      aria-labelledby="backup-target-form-title"
    >
      <div className="flex max-h-full w-full max-w-lg flex-col rounded-xl border border-gray-800 bg-gray-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
          <h2
            id="backup-target-form-title"
            className="text-base font-semibold text-white"
          >
            {isEdit ? '백업 대상 수정' : '백업 대상 추가'}
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

        <form
          onSubmit={handleSubmit}
          className="space-y-4 overflow-y-auto px-5 py-4"
          autoComplete="off"
        >
          <Field
            id="backup-target-name"
            label="이름"
            hint={
              isEdit
                ? '백업이 저장되는 폴더 이름이라 바꿀 수 없습니다.'
                : '백업이 저장되는 폴더 이름으로 쓰이며, 등록한 뒤에는 바꿀 수 없습니다.'
            }
          >
            <input
              id="backup-target-name"
              type="text"
              value={form.name}
              onChange={(event) => update('name', event.target.value)}
              placeholder="예: my-app-prod"
              disabled={isEdit}
              autoFocus={!isEdit}
              aria-describedby="backup-target-name-hint"
              className={`${FIELD_CLASS} font-mono`}
            />
          </Field>

          <Field id="backup-target-description" label="설명 (선택)">
            <input
              id="backup-target-description"
              type="text"
              value={form.description}
              onChange={(event) => update('description', event.target.value)}
              placeholder="예: 운영 DB (Atlas)"
              maxLength={500}
              className={FIELD_CLASS}
            />
          </Field>

          <Field
            id="backup-target-uri"
            label={isEdit ? '접속 URI (바꿀 때만 입력)' : '접속 URI'}
            hint={
              <>
                {isEdit && target
                  ? `현재 접속 위치: ${target.connectionSummary} · `
                  : ''}
                URI 경로에 적힌 데이터베이스만 덤프합니다. 암호화해 저장하며
                다시 보여주지 않습니다. 읽기 전용 계정을 권장합니다.
              </>
            }
          >
            <div className="relative">
              <input
                id="backup-target-uri"
                type={showUri ? 'text' : 'password'}
                value={form.uri}
                onChange={(event) => update('uri', event.target.value)}
                placeholder={
                  isEdit
                    ? '비워 두면 저장된 접속 정보를 그대로 씁니다'
                    : 'mongodb+srv://user:password@host/database'
                }
                autoComplete="new-password"
                spellCheck={false}
                aria-describedby="backup-target-uri-hint"
                className={`${FIELD_CLASS} pr-10 font-mono`}
              />
              <button
                type="button"
                onClick={() => setShowUri((visible) => !visible)}
                aria-label={showUri ? '접속 URI 가리기' : '접속 URI 보기'}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-500 hover:text-white"
              >
                {showUri ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              id="backup-target-schedule-time"
              label="매일 실행 시각"
              hint={`${timeZone} 기준`}
            >
              <input
                id="backup-target-schedule-time"
                type="time"
                value={form.scheduleTime}
                onChange={(event) => update('scheduleTime', event.target.value)}
                aria-describedby="backup-target-schedule-time-hint"
                className={FIELD_CLASS}
              />
            </Field>

            <Field
              id="backup-target-retention-days"
              label="보관 기간 (일)"
              hint="새 백업이 성공한 뒤 이보다 오래된 백업을 지웁니다."
            >
              <input
                id="backup-target-retention-days"
                type="number"
                min={1}
                max={MAX_BACKUP_RETENTION_DAYS}
                value={form.retentionDays}
                onChange={(event) =>
                  update('retentionDays', event.target.value)
                }
                aria-describedby="backup-target-retention-days-hint"
                className={FIELD_CLASS}
              />
            </Field>
          </div>

          <Field
            id="backup-target-dump-image"
            label="덤프 이미지"
            hint="mongodump 를 실행할 Docker 이미지입니다. 서버 버전에 맞춰 바꿀 수 있습니다."
          >
            <input
              id="backup-target-dump-image"
              type="text"
              value={form.dumpImage}
              onChange={(event) => update('dumpImage', event.target.value)}
              spellCheck={false}
              aria-describedby="backup-target-dump-image-hint"
              className={`${FIELD_CLASS} font-mono`}
            />
          </Field>

          <div className="flex items-start gap-2.5 rounded-lg border border-gray-800 bg-gray-950/50 px-3 py-2.5">
            <input
              id="backup-target-enabled"
              type="checkbox"
              checked={form.enabled}
              onChange={(event) => update('enabled', event.target.checked)}
              aria-describedby="backup-target-enabled-hint"
              className="mt-0.5 h-4 w-4 rounded border-gray-600 bg-gray-900 accent-emerald-500"
            />
            <div>
              <label
                htmlFor="backup-target-enabled"
                className="block text-sm text-gray-200"
              >
                예약 백업 사용
              </label>
              <p id="backup-target-enabled-hint" className={HINT_CLASS}>
                끄면 예약 실행을 멈춥니다. 수동 실행은 계속 할 수 있습니다.
              </p>
            </div>
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
