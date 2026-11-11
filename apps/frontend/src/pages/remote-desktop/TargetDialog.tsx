import { useState, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import {
  Dialog,
  DIALOG_INPUT_CLASS,
  DIALOG_LABEL_CLASS,
  dialogButtonClass,
} from '@/shared/ui';
import {
  formFor,
  toPayload,
  validate,
  withProtocol,
  type Target,
  type TargetForm,
  type TargetFormErrors,
} from './target-model';

export type TargetDialogMode =
  | { kind: 'create' }
  | { kind: 'edit'; target: Target }
  // RDP 대상에 저장된 계정이 없어 연결 전에 계정을 받는 경우
  | { kind: 'credentials'; target: Target };

const TITLE = {
  create: '원격 대상 추가',
  edit: '접속 정보 변경',
  credentials: '접속 계정 입력',
} as const;

// 서버의 검증 메시지는 사용자에게 보여 줘도 되는 한국어 문장이라 그대로 씀
function serverMessage(error: unknown) {
  const message = (
    error as { response?: { status?: number; data?: { message?: unknown } } }
  )?.response;
  if (message?.status === 400 && typeof message.data?.message === 'string')
    return message.data.message;
  return '저장하지 못했습니다. 입력값과 관리자 권한을 확인한 뒤 다시 시도하세요.';
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className={DIALOG_LABEL_CLASS}>
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-300">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="mb-2 text-[11px] font-semibold tracking-wide text-gray-400">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

export function TargetDialog({
  mode,
  onClose,
  onSave,
}: {
  mode: TargetDialogMode;
  onClose: () => void;
  onSave: (id: string | undefined, payload: object) => Promise<void>;
}) {
  const target = mode.kind === 'create' ? undefined : mode.target;
  const isLocal = target?.id === 'local';
  const accountOnly = mode.kind === 'credentials';
  const [form, setForm] = useState<TargetForm>(() => formFor(target));
  const [errors, setErrors] = useState<TargetFormErrors>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const [reveal, setReveal] = useState(false);
  const kept = Boolean(target?.hasCredentials);
  const set = (patch: Partial<TargetForm>) => setForm({ ...form, ...patch });
  const input = (id: keyof TargetFormErrors) => ({
    id: `target-${id}`,
    className: DIALOG_INPUT_CLASS,
    'aria-invalid': Boolean(errors[id]),
    'aria-describedby': errors[id] ? `target-${id}-error` : undefined,
  });

  async function submit() {
    const found = validate(form, target);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    setFailure('');
    try {
      await onSave(target?.id, toPayload(form, target));
    } catch (error) {
      setFailure(serverMessage(error));
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      title={
        accountOnly ? `${target?.name} ${TITLE.credentials}` : TITLE[mode.kind]
      }
      description={
        accountOnly
          ? 'Windows 로그인 계정이 있어야 연결할 수 있습니다. 저장하면 바로 연결합니다.'
          : '암호는 서버에 암호화해 보관하고 연결할 때만 씁니다.'
      }
      busy={busy}
      onClose={onClose}
      autoComplete="off"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      footer={
        <>
          <button
            type="button"
            className={dialogButtonClass()}
            disabled={busy}
            onClick={onClose}
          >
            취소
          </button>
          <button
            type="submit"
            className={dialogButtonClass('blue')}
            disabled={busy}
          >
            {busy ? '저장 중' : accountOnly ? '저장하고 연결' : '저장'}
          </button>
        </>
      }
    >
      <div className="space-y-6">
        {!accountOnly && (
          <Group title="기본">
            <Field id="target-name" label="이름" error={errors.name}>
              <input
                {...input('name')}
                required
                maxLength={80}
                placeholder="작업 PC"
                value={form.name}
                onChange={(event) => set({ name: event.target.value })}
              />
            </Field>
            {!isLocal && (
              <Field id="target-protocol" label="연결 방식">
                <select
                  id="target-protocol"
                  className={DIALOG_INPUT_CLASS}
                  value={form.protocol}
                  onChange={(event) =>
                    setForm(
                      withProtocol(form, event.target.value as 'vnc' | 'rdp'),
                    )
                  }
                >
                  <option value="vnc">화면 공유 (VNC)</option>
                  <option value="rdp">Windows 원격 데스크톱 (RDP)</option>
                </select>
              </Field>
            )}
          </Group>
        )}
        {!accountOnly && (
          <Group title="네트워크">
            {!isLocal && (
              <Field
                id="target-host"
                label="주소"
                hint={
                  form.protocol === 'rdp'
                    ? '같은 망의 사설 IPv4 주소입니다.'
                    : '같은 망의 사설 IPv4 주소입니다. 비우면 이 서버(SSH 터널 포트)로 연결합니다.'
                }
                error={errors.host}
              >
                <input
                  {...input('host')}
                  inputMode="decimal"
                  maxLength={15}
                  placeholder="10.0.0.x"
                  value={form.host}
                  onChange={(event) => set({ host: event.target.value })}
                />
              </Field>
            )}
            <Field
              id="target-port"
              label="포트"
              hint="VNC는 보통 5900, RDP는 3389입니다."
              error={errors.port}
            >
              <input
                {...input('port')}
                required
                inputMode="numeric"
                maxLength={5}
                value={form.port}
                onChange={(event) =>
                  set({ port: event.target.value, portEdited: true })
                }
              />
            </Field>
          </Group>
        )}
        {!accountOnly && !isLocal && (
          <Group title="깨우기 (선택)">
            <Field
              id="target-wakeMac"
              label="MAC 주소"
              hint="넣으면 꺼진 컴퓨터를 원격으로 켤 수 있습니다."
              error={errors.wakeMac}
            >
              <input
                {...input('wakeMac')}
                maxLength={17}
                placeholder="00:00:5E:00:53:01"
                value={form.wakeMac}
                onChange={(event) => set({ wakeMac: event.target.value })}
              />
            </Field>
          </Group>
        )}
        <Group title="계정">
          {!accountOnly && (
            <p className="text-xs text-gray-500">
              {kept ? '계정이 저장되어 있습니다. ' : ''}모든 전체 관리자가 이
              접속 정보를 씁니다.
            </p>
          )}
          <Field
            id="target-username"
            label="사용자 이름"
            hint={
              kept ? '비워 두면 저장된 사용자 이름을 그대로 씁니다.' : undefined
            }
          >
            <input
              id="target-username"
              className={DIALOG_INPUT_CLASS}
              autoComplete="off"
              maxLength={255}
              value={form.username}
              onChange={(event) => set({ username: event.target.value })}
            />
          </Field>
          <Field
            id="target-password"
            label="암호"
            hint={
              kept && form.saveCredentials
                ? '비워 두면 저장된 암호를 그대로 씁니다.'
                : undefined
            }
            error={errors.password}
          >
            <div className="relative">
              <input
                {...input('password')}
                className={`${DIALOG_INPUT_CLASS} pr-10`}
                type={reveal ? 'text' : 'password'}
                autoComplete="new-password"
                maxLength={1024}
                autoFocus={accountOnly}
                placeholder={
                  kept ? '저장된 암호 유지 · 바꾸려면 새로 입력' : '암호 입력'
                }
                value={form.password}
                onChange={(event) => set({ password: event.target.value })}
              />
              <button
                type="button"
                aria-label={reveal ? '암호 숨기기' : '암호 보기'}
                aria-pressed={reveal}
                onClick={() => setReveal(!reveal)}
                className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-lg text-gray-400 hover:text-white"
              >
                {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </Field>
          {!accountOnly && (
            <label className="flex items-start gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={form.saveCredentials}
                onChange={(event) =>
                  set({ saveCredentials: event.target.checked })
                }
              />
              <span>
                계정·암호 암호화 저장
                <span className="block text-xs text-gray-500">
                  끄면 저장된 계정과 암호를 지웁니다.
                </span>
              </span>
            </label>
          )}
        </Group>
        {failure && (
          <p role="alert" className="text-sm text-red-300">
            {failure}
          </p>
        )}
      </div>
    </Dialog>
  );
}
