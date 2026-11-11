import type { MfaChallengeToken, MfaEnrollmentSetup } from '@/shared/model';
import { mfaService } from '../api/mfa.service';
import type { EnrolledLogin } from '../model/mfa.types';
import { isCompleteOtp, useMfaCodeForm } from '../model/useMfaCodeForm';
import { AuthStepHeading } from './AuthCard';
import {
  LOGIN_CODE_INPUT_CLASS,
  LOGIN_ERROR_CLASS,
  LOGIN_LINK_CLASS,
  LOGIN_PRIMARY_BUTTON_CLASS,
} from './login.styles';
import { MfaSetupPanel } from './MfaSetupPanel';

interface MfaEnrollmentStepProps {
  challenge: MfaChallengeToken;
  enrollment: MfaEnrollmentSetup;
  onEnrolled: (login: EnrolledLogin) => void;
  onExpired: () => void;
  onBack: () => void;
}

export function MfaEnrollmentStep({
  challenge,
  enrollment,
  onEnrolled,
  onExpired,
  onBack,
}: MfaEnrollmentStepProps) {
  const form = useMfaCodeForm({
    submit: (code) => mfaService.completeEnrollment(challenge.token, code),
    onSuccess: onEnrolled,
    onExpired,
  });

  return (
    <>
      <AuthStepHeading
        title="2단계 인증 설정"
        description="이 계정은 2단계 인증을 켜야 로그인할 수 있습니다. 인증 앱으로 QR 코드를 찍고 앱에 표시된 코드를 입력하세요."
      />

      {form.error && (
        <div role="alert" className={LOGIN_ERROR_CLASS}>
          {form.error}
        </div>
      )}

      <form onSubmit={form.handleSubmit} className="space-y-4">
        <MfaSetupPanel
          enrollment={enrollment}
          code={form.code}
          onCodeChange={form.setCode}
          inputClassName={LOGIN_CODE_INPUT_CLASS}
          inputRef={form.inputRef}
        />
        <p className="text-xs leading-5 text-slate-500">
          설정을 마치면 다른 기기의 로그인은 모두 끊깁니다.
        </p>
        <button
          type="submit"
          disabled={!isCompleteOtp(form.code) || form.submitting}
          className={LOGIN_PRIMARY_BUTTON_CLASS}
        >
          {form.submitting ? '확인 중...' : '설정 완료'}
        </button>
      </form>

      <div className="mt-5 text-center">
        <button type="button" onClick={onBack} className={LOGIN_LINK_CLASS}>
          비밀번호 입력으로 돌아가기
        </button>
      </div>
    </>
  );
}
