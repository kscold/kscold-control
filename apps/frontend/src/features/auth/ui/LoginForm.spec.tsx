import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { api } from '@/shared/api/client';
import { LoginForm } from './LoginForm';

afterEach(() => {
  vi.restoreAllMocks();
});

async function renderAfterSettingLoads(setting: Promise<unknown>) {
  const get = vi.spyOn(api, 'get').mockReturnValue(setting as never);
  render(
    <MemoryRouter>
      <LoginForm />
    </MemoryRouter>,
  );
  await act(async () => {
    await setting.catch(() => undefined);
  });
  return get;
}

it('공개 가입이 닫혀 있으면 가입 요청 버튼을 보이지 않는다', async () => {
  const get = await renderAfterSettingLoads(
    Promise.resolve({ data: { enabled: false } }),
  );

  expect(get).toHaveBeenCalledWith('/auth/registration');
  expect(screen.getByRole('button', { name: '로그인' })).toBeVisible();
  expect(
    screen.queryByRole('button', { name: '회원가입 요청' }),
  ).not.toBeInTheDocument();
});

it('설정을 못 읽으면 가입 요청 버튼을 숨긴 채로 둔다', async () => {
  await renderAfterSettingLoads(Promise.reject(new Error('network')));

  expect(
    screen.queryByRole('button', { name: '회원가입 요청' }),
  ).not.toBeInTheDocument();
});

it('운영자가 가입을 열면 가입 요청 버튼을 보인다', async () => {
  await renderAfterSettingLoads(Promise.resolve({ data: { enabled: true } }));

  expect(screen.getByRole('button', { name: '회원가입 요청' })).toBeVisible();
});
