import { useState, type FormEvent, type ReactNode } from 'react';
import { KeyRound } from 'lucide-react';
import { Dialog, dialogButtonClass, dialogInputClass } from '@/shared/ui';
import { keyManagementService } from '../api/key-management.service';
import {
  EMPTY_TARGET_FORM as EMPTY,
  TARGET_KINDS as KINDS,
  toTargetInput,
  type TargetForm as FormState,
  type TargetKind,
} from '../lib/target-form';

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm text-gray-300">
      <span className="mb-1 block">{label}</span>
      {children}
      {hint ? (
        <span className="mt-1 block text-xs text-gray-500">{hint}</span>
      ) : null}
    </label>
  );
}

interface TargetFormDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (targetId: string) => void;
}

/** 운영 키 대상 등록. 저장 방식에 맞는 칸만 보여 준다. */
export function TargetFormDialog({
  open,
  onClose,
  onCreated,
}: TargetFormDialogProps) {
  const [kind, setKind] = useState<TargetKind>('ssh-command');
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = dialogInputClass('emerald');
  const set =
    (key: keyof FormState) => (event: { target: { value: string } }) =>
      setForm((current) => ({ ...current, [key]: event.target.value }));

  const close = () => {
    if (busy) return;
    setForm(EMPTY);
    setError(null);
    onClose();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await keyManagementService.createTarget(
        toTargetInput(kind, form),
      );
      setForm(EMPTY);
      onCreated(created.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const ssh = kind !== 'gcp';

  return (
    <Dialog
      open={open}
      title="운영 키 대상 추가"
      description={KINDS.find((item) => item.value === kind)?.hint}
      icon={<KeyRound size={18} />}
      size="lg"
      busy={busy}
      closeOnBackdrop={false}
      onClose={close}
      onSubmit={(event) => void submit(event)}
      autoComplete="off"
      footer={
        <>
          <button
            type="button"
            className={dialogButtonClass('neutral')}
            onClick={close}
            disabled={busy}
          >
            취소
          </button>
          <button
            type="submit"
            className={dialogButtonClass('emerald')}
            disabled={busy}
          >
            {busy ? '확인하는 중…' : '추가'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div
          role="radiogroup"
          aria-label="저장 방식"
          className="grid grid-cols-1 gap-2 sm:grid-cols-3"
        >
          {KINDS.map((item) => (
            <button
              key={item.value}
              type="button"
              role="radio"
              aria-checked={kind === item.value}
              onClick={() => setKind(item.value)}
              className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                kind === item.value
                  ? 'border-emerald-500 bg-emerald-500/10 text-white'
                  : 'border-gray-700 text-gray-400 hover:text-gray-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="ID" hint="영문 소문자·숫자·- (예: shop-production)">
            <input
              required
              className={input}
              value={form.id}
              onChange={set('id')}
            />
          </Field>
          <Field label="이름">
            <input
              required
              className={input}
              value={form.displayName}
              onChange={set('displayName')}
            />
          </Field>
          <Field label="환경">
            <select
              className={input}
              value={form.environment}
              onChange={set('environment')}
            >
              <option value="production">운영(production)</option>
              <option value="staging">스테이징(staging)</option>
              <option value="development">개발(development)</option>
            </select>
          </Field>
          <Field label=".env 파일 이름">
            <input
              required
              className={input}
              value={form.envFileName}
              onChange={set('envFileName')}
            />
          </Field>
        </div>

        <Field
          label="꼭 있어야 하는 키"
          hint="쉼표나 줄바꿈으로 구분 (예: NODE_ENV, DATABASE_URL)"
        >
          <textarea
            required
            rows={2}
            className={input}
            value={form.requiredKeys}
            onChange={set('requiredKeys')}
          />
        </Field>

        {ssh ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="SSH 호스트">
              <input
                required
                className={input}
                value={form.host}
                onChange={set('host')}
              />
            </Field>
            <Field label="SSH 포트">
              <input
                required
                inputMode="numeric"
                className={input}
                value={form.port}
                onChange={set('port')}
              />
            </Field>
            <Field label="SSH 사용자">
              <input
                required
                className={input}
                value={form.username}
                onChange={set('username')}
              />
            </Field>
            <Field
              label="SSH 키 이름"
              hint={`이 서버의 ~/.ssh/kscold-control-${form.credentialRef || '<키 이름>'} 개인 키로 접속합니다.`}
            >
              <input
                required
                className={input}
                value={form.credentialRef}
                onChange={set('credentialRef')}
              />
            </Field>
          </div>
        ) : null}

        {kind === 'ssh-command' ? (
          <Field
            label="관리할 키"
            hint="* 는 위험한 예약 키를 뺀 모든 키, 아니면 키를 나열"
          >
            <input
              required
              className={input}
              value={form.allowedKeys}
              onChange={set('allowedKeys')}
            />
          </Field>
        ) : null}

        {kind === 'ssh-file' ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="원격 .env 경로" hint="/로 시작하는 전체 경로">
              <input
                required
                className={input}
                value={form.envPath}
                onChange={set('envPath')}
              />
            </Field>
            <Field label="배포 작업 폴더">
              <input
                required
                className={input}
                value={form.workingDirectory}
                onChange={set('workingDirectory')}
              />
            </Field>
            <Field label="배포 스크립트 이름">
              <input
                required
                className={input}
                value={form.script}
                onChange={set('script')}
              />
            </Field>
            <Field label="배포 상태 폴더">
              <input
                required
                className={input}
                value={form.statusDirectory}
                onChange={set('statusDirectory')}
              />
            </Field>
          </div>
        ) : null}

        {kind === 'gcp' ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="GCP 프로젝트 ID">
              <input
                required
                className={input}
                value={form.projectId}
                onChange={set('projectId')}
              />
            </Field>
            <Field label="비밀 이름">
              <input
                required
                className={input}
                value={form.secretName}
                onChange={set('secretName')}
              />
            </Field>
            <Field label="서비스 계정">
              <input
                required
                className={input}
                value={form.serviceAccount}
                onChange={set('serviceAccount')}
              />
            </Field>
            <Field label="GitHub 저장소" hint="owner/name">
              <input
                required
                className={input}
                value={form.repository}
                onChange={set('repository')}
              />
            </Field>
            <Field label="워크플로 파일">
              <input
                required
                className={input}
                value={form.workflow}
                onChange={set('workflow')}
              />
            </Field>
            <Field label="브랜치">
              <input
                required
                className={input}
                value={form.ref}
                onChange={set('ref')}
              />
            </Field>
          </div>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm text-red-200"
          >
            {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
