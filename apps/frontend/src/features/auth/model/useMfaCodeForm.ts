import { useRef, useState, type FormEvent } from 'react';
import { MfaApiError } from '../api/mfa.service';

export const MFA_CHALLENGE_EXPIRED_MESSAGE =
  '인증 시간이 지났거나 코드를 여러 번 틀렸습니다. 다시 로그인해 주세요.';

type MfaFailure = { kind: 'expired' } | { kind: 'message'; text: string };

function describeMfaFailure(error: unknown): MfaFailure {
  if (!(error instanceof MfaApiError)) {
    return {
      kind: 'message',
      text: '요청에 실패했습니다. 다시 시도해 주세요.',
    };
  }
  switch (error.code) {
    case 'MFA_CHALLENGE_EXPIRED':
      return { kind: 'expired' };
    case 'MFA_CODE_INVALID':
      if (error.remainingAttempts === 0) return { kind: 'expired' };
      return {
        kind: 'message',
        text:
          error.remainingAttempts === null
            ? error.message
            : `${error.message} 남은 시도 ${error.remainingAttempts}회`,
      };
    case 'MFA_ALREADY_ENABLED':
      return { kind: 'message', text: '2단계 인증이 이미 켜져 있습니다.' };
    default:
      return { kind: 'message', text: error.message };
  }
}

export function normalizeRecoveryCode(input: string): string {
  const compact = input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
  return compact.match(/.{1,4}/g)?.join('-') ?? '';
}

export const isCompleteOtp = (code: string) => /^\d{6}$/.test(code);
export const isCompleteRecoveryCode = (code: string) =>
  /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code);

interface MfaCodeFormOptions<T> {
  submit: (code: string) => Promise<T>;
  onSuccess: (result: T) => void;
  onExpired?: () => void;
}

export function useMfaCodeForm<T>({
  submit,
  onSuccess,
  onExpired,
}: MfaCodeFormOptions<T>) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setError('');
    let result: T;
    try {
      result = await submit(code);
    } catch (failure) {
      const outcome = describeMfaFailure(failure);
      if (outcome.kind === 'expired' && onExpired) {
        onExpired();
        return;
      }
      setError(
        outcome.kind === 'expired'
          ? MFA_CHALLENGE_EXPIRED_MESSAGE
          : outcome.text,
      );
      setCode('');
      inputRef.current?.focus();
      return;
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
    onSuccess(result);
  };

  const reset = () => {
    setCode('');
    setError('');
  };

  return { code, setCode, error, submitting, handleSubmit, reset, inputRef };
}
