import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios, { AxiosError, AxiosHeaders } from 'axios';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useAuthStore, type AuthUser } from '@/shared/model';
import { LoginForm } from './LoginForm';

const user: AuthUser = {
  id: 'admin-user',
  email: 'admin@example.com',
  roles: ['admin'],
  permissions: ['rbac:manage'],
};

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

function serverAsking(verify: () => Promise<unknown>) {
  return vi.spyOn(axios, 'post').mockImplementation(async (url: string) => {
    if (url.endsWith('/api/auth/login')) {
      return {
        data: {
          kind: 'mfa_required',
          challenge: {
            token: 'challenge-1',
            expiresAt: '2099-01-01T00:00:00.000Z',
          },
        },
      };
    }
    if (url.endsWith('/api/auth/mfa/verify')) return verify();
    throw new Error(`unexpected request ${url}`);
  });
}

async function signInWithPassword() {
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
  await screen.findByRole('heading', { name: '2단계 인증' });
  return person;
}

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

it('인증 앱 코드를 보내 로그인을 마치고 콘솔로 들어간다', async () => {
  const post = serverAsking(async () => ({
    data: { kind: 'authenticated', accessToken: 'session-token', user },
  }));
  const person = await signInWithPassword();

  expect(useAuthStore.getState().token).toBeNull();
  await person.type(screen.getByLabelText('인증 코드'), '123456');
  await person.click(screen.getByRole('button', { name: '확인' }));

  expect(await screen.findByText('콘솔 첫 화면')).toBeVisible();
  expect(post).toHaveBeenLastCalledWith(
    expect.stringContaining('/api/auth/mfa/verify'),
    { challenge: 'challenge-1', method: 'totp', code: '123456' },
  );
  expect(useAuthStore.getState()).toMatchObject({
    token: 'session-token',
    user,
  });
});

it('틀린 코드면 남은 시도 횟수를 보여 주고 이 단계에 머문다', async () => {
  serverAsking(() =>
    Promise.reject(
      rejection(401, {
        code: 'MFA_CODE_INVALID',
        message: '인증 코드가 맞지 않습니다.',
        remainingAttempts: 3,
      }),
    ),
  );
  const person = await signInWithPassword();

  await person.type(screen.getByLabelText('인증 코드'), '000000');
  await person.click(screen.getByRole('button', { name: '확인' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    '인증 코드가 맞지 않습니다. 남은 시도 3회',
  );
  expect(screen.getByLabelText('인증 코드')).toHaveValue('');
  expect(useAuthStore.getState().token).toBeNull();
});

it('복구 코드로 바꿔 입력하면 recovery 방식으로 보낸다', async () => {
  const post = serverAsking(async () => ({
    data: { kind: 'authenticated', accessToken: 'session-token', user },
  }));
  const person = await signInWithPassword();

  await person.click(
    screen.getByRole('button', { name: /복구 코드로 로그인/ }),
  );
  await person.type(screen.getByLabelText('복구 코드'), 'abcd-efgh-jkmn');
  await person.click(screen.getByRole('button', { name: '확인' }));

  expect(await screen.findByText('콘솔 첫 화면')).toBeVisible();
  expect(post).toHaveBeenLastCalledWith(
    expect.stringContaining('/api/auth/mfa/verify'),
    { challenge: 'challenge-1', method: 'recovery', code: 'ABCD-EFGH-JKMN' },
  );
});

it.each([
  ['확인 토큰이 만료되면', { code: 'MFA_CHALLENGE_EXPIRED' }],
  [
    '마지막 시도까지 틀리면',
    { code: 'MFA_CODE_INVALID', remainingAttempts: 0 },
  ],
])('%s 비밀번호 단계로 돌아가 다시 로그인하라고 알린다', async (_, body) => {
  serverAsking(() => Promise.reject(rejection(401, body)));
  const person = await signInWithPassword();

  await person.type(screen.getByLabelText('인증 코드'), '123456');
  await person.click(screen.getByRole('button', { name: '확인' }));

  expect(await screen.findByText(/다시 로그인해 주세요/)).toBeVisible();
  expect(screen.getByPlaceholderText('8자 이상 비밀번호')).toHaveValue('');
  expect(
    screen.queryByRole('heading', { name: '2단계 인증' }),
  ).not.toBeInTheDocument();
  expect(useAuthStore.getState().token).toBeNull();
});

it('예전 세션 토큰이 남아 있어도 틀린 코드는 한 번만 보내고 세션 확인으로 다시 보내지 않는다', async () => {
  useAuthStore.setState({ token: 'old-session-token', user });
  const post = serverAsking(() =>
    Promise.reject(
      rejection(401, {
        code: 'MFA_CODE_INVALID',
        message: '인증 코드가 맞지 않습니다.',
        remainingAttempts: 4,
      }),
    ),
  );
  const get = vi.spyOn(axios, 'get');
  const person = await signInWithPassword();

  await person.type(screen.getByLabelText('인증 코드'), '000000');
  await person.click(screen.getByRole('button', { name: '확인' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('남은 시도 4회');
  const verifyCalls = post.mock.calls.filter(([url]) =>
    String(url).endsWith('/api/auth/mfa/verify'),
  );
  expect(verifyCalls).toHaveLength(1);
  expect(verifyCalls[0]).toHaveLength(2);
  expect(get).not.toHaveBeenCalled();
});
