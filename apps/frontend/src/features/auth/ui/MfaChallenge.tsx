import { useId, useState } from 'react';
import type { AuthenticatedLogin, MfaChallengeToken } from '@/shared/model';
import { mfaService } from '../api/mfa.service';
import type { MfaMethod } from '../model/mfa.types';
import {
  isCompleteOtp,
  isCompleteRecoveryCode,
  normalizeRecoveryCode,
  useMfaCodeForm,
} from '../model/useMfaCodeForm';
import { AuthStepHeading } from './AuthCard';
import {
  LOGIN_CODE_INPUT_CLASS,
  LOGIN_ERROR_CLASS,
  LOGIN_LINK_CLASS,
  LOGIN_PRIMARY_BUTTON_CLASS,
} from './login.styles';
import { OtpInput } from './OtpInput';

interface MfaChallengeProps {
  challenge: MfaChallengeToken;
  onVerified: (login: AuthenticatedLogin) => void;
  onExpired: () => void;
  onBack: () => void;
}

export function MfaChallenge({
  challenge,
  onVerified,
  onExpired,
  onBack,
}: MfaChallengeProps) {
  const [method, setMethod] = useState<MfaMethod>('totp');
  const codeId = useId();
  const form = useMfaCodeForm({
    submit: (code) => mfaService.verify(challenge.token, method, code),
    onSuccess: onVerified,
    onExpired,
  });
  const usingApp = method === 'totp';
  const complete = usingApp
    ? isCompleteOtp(form.code)
    : isCompleteRecoveryCode(form.code);

  const switchMethod = () => {
    setMethod(usingApp ? 'recovery' : 'totp');
    form.reset();
  };

  return (
    <>
      <AuthStepHeading
        title="2단계 인증"
        description={
          usingApp
            ? '인증 앱에 표시된 6자리 코드를 입력하세요.'
            : '저장해 둔 복구 코드 하나를 입력하세요. 입력한 코드는 다시 쓸 수 없습니다.'
        }
      />

      {form.error && (
        <div role="alert" className={LOGIN_ERROR_CLASS}>
          {form.error}
        </div>
      )}

      <form onSubmit={form.handleSubmit} className="space-y-4">
        <div>
          <label htmlFor={codeId} className="mb-1 block text-sm text-slate-400">
            {usingApp ? '인증 코드' : '복구 코드'}
          </label>
          {usingApp ? (
            <OtpInput
              id={codeId}
              value={form.code}
              onChange={form.setCode}
              className={LOGIN_CODE_INPUT_CLASS}
              inputRef={form.inputRef}
            />
          ) : (
            <input
              ref={form.inputRef}
              id={codeId}
              type="text"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              autoFocus
              required
              value={form.code}
              onChange={(event) =>
                form.setCode(normalizeRecoveryCode(event.target.value))
              }
              placeholder="ABCD-EFGH-JKMN"
              className={LOGIN_CODE_INPUT_CLASS}
            />
          )}
        </div>

        <button
          type="submit"
          disabled={!complete || form.submitting}
          className={LOGIN_PRIMARY_BUTTON_CLASS}
        >
          {form.submitting ? '확인 중...' : '확인'}
        </button>
      </form>

      <div className="mt-5 flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={switchMethod}
          className="text-sm text-amber-300 transition-colors hover:text-amber-200"
        >
          {usingApp
            ? '인증 앱을 쓸 수 없나요? 복구 코드로 로그인'
            : '인증 앱 코드로 로그인'}
        </button>
        <button type="button" onClick={onBack} className={LOGIN_LINK_CLASS}>
          비밀번호 입력으로 돌아가기
        </button>
      </div>
    </>
  );
}
