import { useCallback, useEffect, useId, useState, type ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';
import { formatFullDateTime } from '@/shared/lib';
import {
  useAuthStore,
  type MfaChallengeToken,
  type MfaEnrollmentSetup,
} from '@/shared/model';
import {
  DIALOG_LABEL_CLASS,
  Dialog,
  SkeletonBlock,
  dialogButtonClass,
  dialogInputClass,
} from '@/shared/ui';
import { mfaService } from '../api/mfa.service';
import {
  RECOVERY_CODE_COUNT,
  type EnrolledLogin,
  type MfaStatus,
} from '../model/mfa.types';
import { isCompleteOtp, useMfaCodeForm } from '../model/useMfaCodeForm';
import { MfaSetupPanel } from './MfaSetupPanel';
import { OtpInput } from './OtpInput';
import { RecoveryCodesPanel } from './RecoveryCodesPanel';

const CODE_INPUT_CLASS = `${dialogInputClass('emerald')} text-center font-mono tracking-[0.4em]`;
const LOW_RECOVERY_CODES = 2;

type SettingsDialog =
  | { kind: 'closed' }
  | { kind: 'regenerate' }
  | {
      kind: 'enroll';
      challenge: MfaChallengeToken;
      enrollment: MfaEnrollmentSetup;
    }
  | { kind: 'codes'; codes: string[] };

function StatusItem({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-gray-800 bg-gray-950/60 px-3 py-2.5">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-1 truncate text-sm text-white">{children}</dd>
    </div>
  );
}

function RegenerateCodesDialog({
  onClose,
  onRegenerated,
}: {
  onClose: () => void;
  onRegenerated: (codes: string[]) => void;
}) {
  const codeId = useId();
  const form = useMfaCodeForm({
    submit: (code) => mfaService.regenerateRecoveryCodes(code),
    onSuccess: onRegenerated,
  });

  return (
    <Dialog
      open
      title="복구 코드 새로 만들기"
      description="인증 앱에 표시된 지금의 6자리 코드를 입력하세요. 새로 만들면 가지고 있던 복구 코드는 더 이상 쓸 수 없습니다."
      onClose={onClose}
      busy={form.submitting}
      onSubmit={form.handleSubmit}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={form.submitting}
            className={dialogButtonClass()}
          >
            취소
          </button>
          <button
            type="submit"
            disabled={!isCompleteOtp(form.code) || form.submitting}
            className={dialogButtonClass('emerald')}
          >
            {form.submitting ? '만드는 중...' : '새로 만들기'}
          </button>
        </>
      }
    >
      <label htmlFor={codeId} className={DIALOG_LABEL_CLASS}>
        인증 코드
      </label>
      <OtpInput
        id={codeId}
        value={form.code}
        onChange={form.setCode}
        className={CODE_INPUT_CLASS}
        inputRef={form.inputRef}
      />
      {form.error && (
        <p role="alert" className="mt-2 text-sm text-red-400">
          {form.error}
        </p>
      )}
    </Dialog>
  );
}

function EnrollDialog({
  challenge,
  enrollment,
  onClose,
  onEnrolled,
  onExpired,
}: {
  challenge: MfaChallengeToken;
  enrollment: MfaEnrollmentSetup;
  onClose: () => void;
  onEnrolled: (login: EnrolledLogin) => void;
  onExpired: () => void;
}) {
  const form = useMfaCodeForm({
    submit: (code) => mfaService.completeEnrollment(challenge.token, code),
    onSuccess: onEnrolled,
    onExpired,
  });

  return (
    <Dialog
      open
      title="2단계 인증 켜기"
      description="인증 앱으로 QR 코드를 찍거나 키를 직접 입력한 뒤, 앱에 표시된 코드를 입력하세요."
      onClose={onClose}
      busy={form.submitting}
      onSubmit={form.handleSubmit}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={form.submitting}
            className={dialogButtonClass()}
          >
            취소
          </button>
          <button
            type="submit"
            disabled={!isCompleteOtp(form.code) || form.submitting}
            className={dialogButtonClass('emerald')}
          >
            {form.submitting ? '확인 중...' : '켜기'}
          </button>
        </>
      }
    >
      <MfaSetupPanel
        enrollment={enrollment}
        code={form.code}
        onCodeChange={form.setCode}
        inputClassName={CODE_INPUT_CLASS}
        inputRef={form.inputRef}
      />
      <p className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-100">
        켜면 지금 쓰는 이 화면을 뺀 다른 기기의 로그인이 모두 끊깁니다.
      </p>
      {form.error && (
        <p role="alert" className="mt-2 text-sm text-red-400">
          {form.error}
        </p>
      )}
    </Dialog>
  );
}

function RecoveryCodesDialog({
  codes,
  onClose,
}: {
  codes: string[];
  onClose: () => void;
}) {
  const [saved, setSaved] = useState(false);
  return (
    <Dialog
      open
      title="새 복구 코드"
      onClose={() => {
        if (saved) onClose();
      }}
      showCloseButton={false}
      footer={
        <button
          type="button"
          disabled={!saved}
          onClick={onClose}
          className={dialogButtonClass('emerald')}
        >
          완료
        </button>
      }
    >
      <RecoveryCodesPanel
        codes={codes}
        saved={saved}
        onSavedChange={setSaved}
      />
    </Dialog>
  );
}

export function MfaSettingsSection() {
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [loadError, setLoadError] = useState('');
  const [dialog, setDialog] = useState<SettingsDialog>({ kind: 'closed' });
  const [starting, setStarting] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      setStatus(await mfaService.getStatus());
      setLoadError('');
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : '2단계 인증 상태를 불러오지 못했습니다.',
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const close = () => setDialog({ kind: 'closed' });

  const showCodes = (codes: string[]) => {
    setDialog({ kind: 'codes', codes });
    void load();
  };

  const startEnrollment = async () => {
    setStarting(true);
    setNotice('');
    try {
      setDialog({ kind: 'enroll', ...(await mfaService.startEnrollment()) });
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : '2단계 인증 설정을 시작하지 못했습니다.',
      );
      void load();
    } finally {
      setStarting(false);
    }
  };

  const handleEnrolled = (login: EnrolledLogin) => {
    useAuthStore.getState().applyLogin(login);
    showCodes(login.recoveryCodes);
  };

  const handleEnrollmentExpired = () => {
    close();
    setNotice('설정 시간이 지났습니다. 처음부터 다시 시작해 주세요.');
  };

  return (
    <section className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <ShieldCheck size={20} className="mt-0.5 shrink-0 text-emerald-400" />
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-white">2단계 인증</h2>
          <p className="mt-1 text-sm leading-6 text-gray-400">
            로그인할 때 비밀번호와 함께 인증 앱의 6자리 코드를 확인합니다.
            비밀번호가 새어 나가도 코드 없이는 들어올 수 없습니다.
          </p>
        </div>
      </div>

      {status === null ? (
        loadError ? (
          <p role="alert" className="mt-4 text-sm text-red-400">
            {loadError}
          </p>
        ) : (
          <SkeletonBlock className="mt-5 h-16 w-full rounded-xl" />
        )
      ) : (
        <>
          <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatusItem label="상태">
              {status.enabled ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  사용 중
                </span>
              ) : (
                <span className="text-gray-300">사용 안 함</span>
              )}
            </StatusItem>
            <StatusItem label="켠 날짜">
              {formatFullDateTime(status.enabledAt, '-')}
            </StatusItem>
            <StatusItem label="남은 복구 코드">
              {status.enabled
                ? `${status.recoveryCodesRemaining} / ${RECOVERY_CODE_COUNT}`
                : '-'}
            </StatusItem>
          </dl>

          {status.required && (
            <p className="mt-3 text-xs leading-5 text-amber-300">
              이 계정의 역할은 2단계 인증을 꼭 켜야 합니다.
            </p>
          )}
          {status.enabled &&
            status.recoveryCodesRemaining <= LOW_RECOVERY_CODES && (
              <p className="mt-3 text-xs leading-5 text-amber-300">
                복구 코드가 {status.recoveryCodesRemaining}개 남았습니다. 새로
                만들어 두세요.
              </p>
            )}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            {status.enabled ? (
              <>
                <button
                  type="button"
                  onClick={() => setDialog({ kind: 'regenerate' })}
                  className={dialogButtonClass()}
                >
                  복구 코드 새로 만들기
                </button>
                <p className="text-xs leading-5 text-gray-500">
                  새로 만들면 가지고 있던 복구 코드는 더 이상 쓸 수 없습니다.
                </p>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={starting}
                  onClick={() => void startEnrollment()}
                  className={dialogButtonClass('emerald')}
                >
                  {starting ? '준비 중...' : '2단계 인증 켜기'}
                </button>
                <p className="text-xs leading-5 text-gray-500">
                  켜면 지금 쓰는 이 화면을 뺀 다른 기기의 로그인이 모두
                  끊깁니다.
                </p>
              </>
            )}
          </div>

          {notice && (
            <p role="alert" className="mt-3 text-sm text-red-400">
              {notice}
            </p>
          )}
        </>
      )}

      {dialog.kind === 'regenerate' && (
        <RegenerateCodesDialog onClose={close} onRegenerated={showCodes} />
      )}
      {dialog.kind === 'enroll' && (
        <EnrollDialog
          challenge={dialog.challenge}
          enrollment={dialog.enrollment}
          onClose={close}
          onEnrolled={handleEnrolled}
          onExpired={handleEnrollmentExpired}
        />
      )}
      {dialog.kind === 'codes' && (
        <RecoveryCodesDialog codes={dialog.codes} onClose={close} />
      )}
    </section>
  );
}
