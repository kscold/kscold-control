import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios, { AxiosError, AxiosHeaders } from 'axios';
import { api } from '@/shared/api/client';
import { useAuthStore, type AuthUser } from '@/shared/model';
import { MfaSettingsSection } from './MfaSettingsSection';

const user: AuthUser = {
  id: 'admin-user',
  email: 'admin@example.com',
  roles: ['admin'],
  permissions: ['rbac:manage'],
};
const newCodes = Array.from(
  { length: 10 },
  (_, index) => `WXYZ-WXYZ-WX${String(index).padStart(2, '0')}`,
);

function rejection(status: number, data: Record<string, unknown>) {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('Request failed', undefined, config, undefined, {
    status,
    statusText: '',
    data,
    headers: new AxiosHeaders(),
    config,
  });
}

beforeEach(() => {
  localStorage.clear();
  useAuthStore.setState({
    token: 'password-only-token',
    user,
    impersonation: null,
    isValidating: false,
  });
});

afterEach(() => vi.restoreAllMocks());

it('현재 코드를 확인하고 새 복구 코드를 같은 창에서 보여 준다', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: {
      enabled: true,
      enabledAt: '2026-11-01T00:00:00.000Z',
      recoveryCodesRemaining: 2,
      required: true,
    },
  });
  const post = vi
    .spyOn(api, 'post')
    .mockRejectedValueOnce(
      rejection(403, {
        code: 'MFA_CODE_INVALID',
        message: '인증 코드가 맞지 않습니다.',
      }),
    )
    .mockResolvedValueOnce({ data: { recoveryCodes: newCodes } });
  const person = userEvent.setup();
  render(<MfaSettingsSection />);

  expect(await screen.findByText('사용 중')).toBeVisible();
  expect(screen.getByText('2 / 10')).toBeVisible();
  expect(screen.getByText(/꼭 켜야 합니다/)).toBeVisible();

  await person.click(
    screen.getByRole('button', { name: '복구 코드 새로 만들기' }),
  );
  const dialog = screen.getByRole('dialog');
  await person.type(within(dialog).getByLabelText('인증 코드'), '111111');
  await person.click(
    within(dialog).getByRole('button', { name: '새로 만들기' }),
  );
  expect(await within(dialog).findByRole('alert')).toHaveTextContent(
    '코드가 맞지 않습니다',
  );

  await person.type(within(dialog).getByLabelText('인증 코드'), '222222');
  await person.click(
    within(dialog).getByRole('button', { name: '새로 만들기' }),
  );

  const codes = await screen.findByRole('list', { name: '복구 코드' });
  expect(codes.querySelectorAll('li')).toHaveLength(10);
  expect(post).toHaveBeenLastCalledWith('/auth/mfa/recovery-codes', {
    code: '222222',
  });
  const done = screen.getByRole('button', { name: '완료' });
  expect(done).toBeDisabled();
  await person.click(screen.getByLabelText('안전한 곳에 저장했습니다'));
  await person.click(done);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('비밀번호를 다시 확인한 뒤에만 설정을 시작하고 확인 토큰으로 마친다', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: {
      enabled: false,
      enabledAt: null,
      recoveryCodesRemaining: 0,
      required: false,
    },
  });
  const start = vi
    .spyOn(api, 'post')
    .mockRejectedValueOnce(
      rejection(403, {
        code: 'MFA_PASSWORD_INVALID',
        message: '비밀번호가 맞지 않습니다.',
      }),
    )
    .mockResolvedValueOnce({
      data: {
        challenge: { token: 'challenge-2', expiresAt: '2099-01-01T00:00:00Z' },
        enrollment: {
          secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
          otpauthUri: 'otpauth://totp/kscold-control:admin%40example.com',
        },
      },
    });
  const complete = vi.spyOn(axios, 'post').mockResolvedValue({
    data: {
      kind: 'authenticated',
      accessToken: 'mfa-session-token',
      user,
      recoveryCodes: newCodes,
    },
  });
  const person = userEvent.setup();
  render(<MfaSettingsSection />);

  await person.click(
    await screen.findByRole('button', { name: '2단계 인증 켜기' }),
  );
  const passwordDialog = await screen.findByRole('dialog');
  await person.type(
    within(passwordDialog).getByLabelText('비밀번호'),
    'wrong password',
  );
  await person.click(
    within(passwordDialog).getByRole('button', { name: '다음' }),
  );
  expect(await within(passwordDialog).findByRole('alert')).toHaveTextContent(
    '비밀번호가 맞지 않습니다.',
  );
  expect(within(passwordDialog).getByLabelText('비밀번호')).toHaveValue('');

  await person.type(
    within(passwordDialog).getByLabelText('비밀번호'),
    'correct horse',
  );
  await person.click(
    within(passwordDialog).getByRole('button', { name: '다음' }),
  );
  expect(start).toHaveBeenLastCalledWith('/auth/mfa/enrollment', {
    password: 'correct horse',
  });

  const dialog = await screen.findByRole('dialog', {
    name: '2단계 인증 켜기',
  });
  expect(dialog).toHaveTextContent('다른 기기의 로그인이 모두 끊깁니다');
  await person.type(
    within(dialog).getByLabelText('앱에 표시된 6자리 코드'),
    '333333',
  );
  await person.click(within(dialog).getByRole('button', { name: '켜기' }));

  expect(await screen.findByRole('list', { name: '복구 코드' })).toBeVisible();
  expect(complete).toHaveBeenCalledWith(
    expect.stringContaining('/api/auth/mfa/enrollment/complete'),
    { challenge: 'challenge-2', code: '333333' },
  );
  expect(useAuthStore.getState().token).toBe('mfa-session-token');
});
