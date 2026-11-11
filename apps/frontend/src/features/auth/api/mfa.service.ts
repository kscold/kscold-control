import axios from 'axios';
import { api } from '@/shared/api/client';
import { ApiError } from '@/shared/api/api-error';
import { API_URL } from '@/shared/config';
import type { AuthenticatedLogin } from '@/shared/model';
import type {
  EnrolledLogin,
  MfaEnrollmentStart,
  MfaMethod,
  MfaStatus,
} from '../model/mfa.types';

export class MfaApiError extends ApiError {
  constructor(
    message: string,
    status: number | undefined,
    code: string | undefined,
    readonly remainingAttempts: number | null,
  ) {
    super(message, status, code);
  }
}

function toMfaError(error: unknown, fallback: string): Error {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error : new Error(fallback);
  }
  const data = error.response?.data as
    | { message?: unknown; code?: unknown; remainingAttempts?: unknown }
    | undefined;
  const code =
    typeof data?.code === 'string' && /^[A-Z_]{1,64}$/.test(data.code)
      ? data.code
      : error.code;
  return new MfaApiError(
    typeof data?.message === 'string' && data.message ? data.message : fallback,
    error.response?.status,
    code,
    typeof data?.remainingAttempts === 'number' ? data.remainingAttempts : null,
  );
}

async function request<T>(
  send: () => Promise<{ data: T }>,
  fallback: string,
): Promise<T> {
  try {
    const { data } = await send();
    return data;
  } catch (error) {
    throw toMfaError(error, fallback);
  }
}

const challengeUrl = (path: string) => `${API_URL}/api/auth/mfa${path}`;

export const mfaService = {
  verify(challenge: string, method: MfaMethod, code: string) {
    return request(
      () =>
        axios.post<AuthenticatedLogin>(challengeUrl('/verify'), {
          challenge,
          method,
          code,
        }),
      '2단계 인증을 확인하지 못했습니다.',
    );
  },

  completeEnrollment(challenge: string, code: string) {
    return request(
      () =>
        axios.post<EnrolledLogin>(challengeUrl('/enrollment/complete'), {
          challenge,
          code,
        }),
      '2단계 인증을 설정하지 못했습니다.',
    );
  },

  getStatus() {
    return request(
      () => api.get<MfaStatus>('/auth/mfa'),
      '2단계 인증 상태를 불러오지 못했습니다.',
    );
  },

  startEnrollment() {
    return request(
      () => api.post<MfaEnrollmentStart>('/auth/mfa/enrollment'),
      '2단계 인증 설정을 시작하지 못했습니다.',
    );
  },

  async regenerateRecoveryCodes(code: string) {
    const { recoveryCodes } = await request(
      () =>
        api.post<{ recoveryCodes: string[] }>('/auth/mfa/recovery-codes', {
          code,
        }),
      '복구 코드를 새로 만들지 못했습니다.',
    );
    return recoveryCodes;
  },
};
