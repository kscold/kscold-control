import { api } from '@/shared/api/client';

export const authService = {
  /** 운영자가 공개 가입을 열어 두었는가. 못 물어보면 닫힌 것으로 본다. */
  async isRegistrationEnabled(): Promise<boolean> {
    try {
      const { data } = await api.get<{ enabled: boolean }>(
        '/auth/registration',
      );
      return data.enabled === true;
    } catch {
      return false;
    }
  },
};
