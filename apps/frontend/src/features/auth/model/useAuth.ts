import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  AuthenticatedLogin,
  LoginResult,
  MfaChallengeToken,
  MfaEnrollmentSetup,
} from '@/shared/model';
import type { EnrolledLogin } from './mfa.types';
import { MFA_CHALLENGE_EXPIRED_MESSAGE } from './useMfaCodeForm';
import { useAuthStore } from '@/shared/model';
import { authService } from '../api/auth.service';

export type LoginStep =
  | { kind: 'credentials' }
  | { kind: 'mfa'; challenge: MfaChallengeToken }
  | {
      kind: 'enroll';
      challenge: MfaChallengeToken;
      enrollment: MfaEnrollmentSetup;
    }
  | { kind: 'recovery-codes'; codes: string[] };

/**
 * 로그인, 로그아웃, 입력 검증 등 인증 로직을 담당하는 훅
 */
export function useAuth() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [step, setStep] = useState<LoginStep>({ kind: 'credentials' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(false);
  const { login: storeLogin, register: storeRegister } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    void authService.isRegistrationEnabled().then((enabled) => {
      if (active) setRegistrationEnabled(enabled);
    });
    return () => {
      active = false;
    };
  }, []);

  /**
   * 로그인 폼 제출을 처리한다
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      let result: LoginResult;
      if (mode === 'register') {
        if (password !== confirmPassword) {
          setError('비밀번호 확인이 일치하지 않습니다.');
          return;
        }
        result = await storeRegister(email, password);
      } else {
        result = await storeLogin(email, password);
      }
      continueAfterPassword(result);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const continueAfterPassword = (result: LoginResult) => {
    switch (result.kind) {
      case 'authenticated':
        navigate('/');
        return;
      case 'mfa_required':
        setPassword('');
        setStep({ kind: 'mfa', challenge: result.challenge });
        return;
      case 'mfa_enrollment_required':
        setPassword('');
        setStep({
          kind: 'enroll',
          challenge: result.challenge,
          enrollment: result.enrollment,
        });
        return;
    }
  };

  const handleVerified = (login: AuthenticatedLogin) => {
    useAuthStore.getState().applyLogin(login);
    navigate('/');
  };

  const handleEnrolled = (login: EnrolledLogin) => {
    useAuthStore.getState().applyLogin(login);
    setStep({ kind: 'recovery-codes', codes: login.recoveryCodes });
  };

  const handleChallengeExpired = () => {
    setStep({ kind: 'credentials' });
    setError(MFA_CHALLENGE_EXPIRED_MESSAGE);
  };

  const returnToCredentials = () => {
    setStep({ kind: 'credentials' });
    setError('');
  };

  const enterConsole = () => navigate('/');

  const changeMode = (nextMode: 'login' | 'register') => {
    setMode(nextMode);
    setError('');
    setPassword('');
    setConfirmPassword('');
  };

  return {
    mode,
    email,
    password,
    confirmPassword,
    error,
    isLoading,
    registrationEnabled,
    setEmail,
    setPassword,
    setConfirmPassword,
    changeMode,
    handleSubmit,
    step,
    handleVerified,
    handleEnrolled,
    handleChallengeExpired,
    returnToCredentials,
    enterConsole,
  };
}
