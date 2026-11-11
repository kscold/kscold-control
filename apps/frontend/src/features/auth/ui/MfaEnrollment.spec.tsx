import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useAuthStore, type AuthUser } from '@/shared/model';
import { LoginForm } from './LoginForm';

const user: AuthUser = {
  id: 'admin-user',
  email: 'admin@example.com',
  roles: ['admin'],
  permissions: ['rbac:manage'],
};
const secret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
const recoveryCodes = Array.from(
  { length: 10 },
  (_, index) => `ABCD-EFGH-JK${String(index).padStart(2, '0')}`,
);

beforeEach(() => {
  localStorage.clear();
  useAuthStore.setState({
    token: null,
    user: null,
    impersonation: null,
    isValidating: false,
  });
});

afterEach(() => vi.restoreAllMocks());

it('필수 계정은 로그인하면서 인증 앱을 등록하고, 복구 코드 저장을 확인해야 들어간다', async () => {
  const post = vi
    .spyOn(axios, 'post')
    .mockImplementation(async (url: string) => {
      if (url.endsWith('/api/auth/login')) {
        return {
          data: {
            kind: 'mfa_enrollment_required',
            challenge: {
              token: 'challenge-1',
              expiresAt: '2099-01-01T00:00:00.000Z',
            },
            enrollment: {
              secret,
              otpauthUri: `otpauth://totp/kscold-control:admin%40example.com?secret=${secret}&issuer=kscold-control`,
            },
          },
        };
      }
      if (url.endsWith('/api/auth/mfa/enrollment/complete')) {
        return {
          data: {
            kind: 'authenticated',
            accessToken: 'session-token',
            user,
            recoveryCodes,
          },
        };
      }
      throw new Error(`unexpected request ${url}`);
    });
  const person = userEvent.setup();
  render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginForm />} />
        <Route path="/" element={<p>콘솔 첫 화면</p>} />
      </Routes>
    </MemoryRouter>,
  );

  await person.type(
    screen.getByPlaceholderText('developer@example.com'),
    'admin@example.com',
  );
  await person.type(
    screen.getByPlaceholderText('8자 이상 비밀번호'),
    'correct-password{Enter}',
  );

  expect(
    await screen.findByRole('img', { name: '인증 앱에 등록할 QR 코드' }),
  ).toBeVisible();
  expect(screen.getByLabelText('설정 키')).toHaveTextContent(
    'JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP',
  );
  expect(useAuthStore.getState().token).toBeNull();

  await person.type(screen.getByLabelText('앱에 표시된 6자리 코드'), '654321');
  await person.click(screen.getByRole('button', { name: '설정 완료' }));

  const codes = await screen.findByRole('list', { name: '복구 코드' });
  expect(codes.querySelectorAll('li')).toHaveLength(10);
  expect(codes).toHaveTextContent('ABCD-EFGH-JK09');
  expect(post).toHaveBeenLastCalledWith(
    expect.stringContaining('/api/auth/mfa/enrollment/complete'),
    { challenge: 'challenge-1', code: '654321' },
  );
  expect(useAuthStore.getState().token).toBe('session-token');

  const proceed = screen.getByRole('button', { name: '계속' });
  expect(proceed).toBeDisabled();
  await person.click(screen.getByLabelText('안전한 곳에 저장했습니다'));
  expect(proceed).toBeEnabled();
  await person.click(proceed);

  expect(await screen.findByText('콘솔 첫 화면')).toBeVisible();
});
