import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PERMISSIONS } from '@/shared/config/permissions';
import { useAuthStore, useModalStore } from '@/shared/model';
import { Modal } from '@/shared/ui/Modal';
import { securityService } from '../api/security.service';
import type { SshAccessOverview } from '../model/security.types';
import { SshAccessPanel } from './SshAccessPanel';

function overview(): SshAccessOverview {
  return {
    recorder: {
      logPath: '/x/ssh-audit.log',
      exists: true,
      updatedAt: '2026-11-10T09:00:00.000Z',
    },
    guard: {
      installed: false,
      running: false,
      updatedAt: null,
      pfEnabled: null,
      blockedCount: null,
      allCount: null,
      sshOnlyCount: null,
    },
    summary: {
      since: '2026-11-03 00:00:00',
      total: 3,
      externalSuccess: 1,
      externalFailure: 1,
      unknownExternalSuccessIps: 1,
      ips: [
        {
          ip: '198.51.100.7',
          scope: 'external',
          known: false,
          success: 1,
          failure: 0,
          users: ['kscold'],
          firstAt: '2026-11-10 17:56:22',
          lastAt: '2026-11-10 17:56:22',
          geo: {
            country: 'NL',
            countryName: '네덜란드',
            city: '암스테르담',
            lat: 52.37,
            lon: 4.89,
          },
        },
      ],
      triedUsers: [{ user: 'root', count: 1 }],
    },
    events: [
      {
        at: '2026-11-10 17:56:22',
        result: '성공',
        user: 'kscold',
        ip: '198.51.100.7',
        method: 'password',
        message: '',
        scope: 'external',
      },
    ],
    sessions: [
      {
        pid: 4634,
        user: 'kscold',
        tty: null,
        startedAt: '2026-11-10T00:10:15.000Z',
        ip: '203.0.113.10',
        port: 62297,
        scope: 'external',
        known: true,
      },
    ],
    pendingAuth: 2,
    knownIps: [{ ip: '203.0.113.10', label: '회사' }],
    blocks: [
      {
        ip: '222.99.122.102',
        source: 'auto',
        blockedAt: '2026-11-10 17:56:05',
        reason: 'root 시도',
        scope: 'all',
        geo: null,
      },
    ],
    countryGuard: {
      enabled: true,
      state: 'on',
      allowedCountries: ['JP', 'KR'],
      blockedByCountry: [],
    },
  };
}

function signIn(permissions: string[]) {
  useAuthStore.setState({
    token: 'token',
    user: { id: 'u', email: 'a@example.com', roles: ['admin'], permissions },
    impersonation: null,
    isValidating: false,
  });
}

function renderPanel() {
  return render(
    <>
      <SshAccessPanel />
      <Modal />
    </>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  useModalStore.getState().close();
});

it('처음 보는 외부 성공 IP 를 경고하고 차단기 설치 안내를 보여 준다', async () => {
  signIn([PERMISSIONS.SECURITY_READ, PERMISSIONS.SECURITY_MANAGE]);
  vi.spyOn(securityService, 'getSshAccess').mockResolvedValue(overview());
  renderPanel();

  expect(await screen.findByText('처음 보는 외부 성공')).toBeInTheDocument();
  expect(screen.getAllByText('처음 보는 IP').length).toBeGreaterThan(0);
  expect(screen.getByText(/setup-ssh-guard\.sh/)).toBeInTheDocument();
  expect(screen.getByText('222.99.122.102')).toBeInTheDocument();
  expect(screen.getByText('네덜란드 암스테르담')).toBeInTheDocument();
});

it('세션 끊기는 확인을 받은 뒤 요청한다', async () => {
  signIn([PERMISSIONS.SECURITY_READ, PERMISSIONS.SECURITY_MANAGE]);
  vi.spyOn(securityService, 'getSshAccess').mockResolvedValue(overview());
  const terminate = vi
    .spyOn(securityService, 'terminateSshSession')
    .mockResolvedValue(overview().sessions[0]);
  renderPanel();

  await userEvent.click(await screen.findByRole('button', { name: /끊기/ }));
  expect(terminate).not.toHaveBeenCalled();
  const dialog = await screen.findByRole('alertdialog');
  await userEvent.click(within(dialog).getByRole('button', { name: '확인' }));
  await waitFor(() => expect(terminate).toHaveBeenCalledWith(4634));
});

it('보기 권한만 있으면 바꾸는 버튼을 숨긴다', async () => {
  signIn([PERMISSIONS.SECURITY_READ]);
  vi.spyOn(securityService, 'getSshAccess').mockResolvedValue(overview());
  renderPanel();

  await screen.findByText('처음 보는 외부 성공');
  expect(screen.queryByRole('button', { name: /끊기/ })).toBeNull();
  expect(screen.queryByRole('button', { name: '해제' })).toBeNull();
  expect(screen.queryByPlaceholderText('막을 IP')).toBeNull();
});

it('새로고침 실패를 이전 결과와 함께 알린다', async () => {
  signIn([PERMISSIONS.SECURITY_READ]);
  const get = vi
    .spyOn(securityService, 'getSshAccess')
    .mockResolvedValue(overview());
  renderPanel();
  await screen.findByText('처음 보는 외부 성공');
  get.mockRejectedValueOnce(new Error('조회 실패'));
  await userEvent.click(screen.getByRole('button', { name: '새로고침' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('이전 조회 결과');
});

it('수동 IP 입력도 영향 범위 확인 후 차단을 요청한다', async () => {
  signIn([PERMISSIONS.SECURITY_READ, PERMISSIONS.SECURITY_MANAGE]);
  vi.spyOn(securityService, 'getSshAccess').mockResolvedValue(overview());
  const block = vi.spyOn(securityService, 'blockSshIp').mockResolvedValue({
    ip: '203.0.113.12',
    source: 'manual',
    blockedAt: null,
    reason: null,
    scope: 'all',
    geo: null,
  });
  renderPanel();
  await userEvent.type(
    await screen.findByPlaceholderText('막을 IP'),
    '203.0.113.12',
  );
  const input = screen.getByPlaceholderText('막을 IP');
  const form = input.closest('form');
  if (!form) throw new Error('차단 입력 폼이 없습니다');
  await userEvent.click(within(form).getByRole('button', { name: '차단' }));
  expect(block).not.toHaveBeenCalled();
  const dialog = await screen.findByRole('alertdialog');
  expect(dialog).toHaveTextContent('운영 중인 사이트');
  await userEvent.click(within(dialog).getByRole('button', { name: '확인' }));
  await waitFor(() =>
    expect(block).toHaveBeenCalledWith('203.0.113.12', undefined, 'all'),
  );
});

it('내 IP 를 별칭과 함께 위에 보여 주고 별칭을 바꾼다', async () => {
  signIn([PERMISSIONS.SECURITY_READ, PERMISSIONS.SECURITY_MANAGE]);
  vi.spyOn(securityService, 'getSshAccess').mockResolvedValue(overview());
  const label = vi
    .spyOn(securityService, 'setSshKnownIpLabel')
    .mockResolvedValue(undefined);
  renderPanel();

  expect(await screen.findByText('회사')).toBeInTheDocument();
  // 열린 세션에도 별칭이 붙는다
  expect(screen.getByText('내 IP · 회사')).toBeInTheDocument();
  await userEvent.click(
    screen.getByRole('button', { name: '203.0.113.10 별칭 바꾸기' }),
  );
  const input = screen.getByRole('textbox', { name: '203.0.113.10 별칭' });
  await userEvent.clear(input);
  await userEvent.type(input, '회사 사무실');
  await userEvent.click(screen.getByRole('button', { name: '저장' }));
  await waitFor(() =>
    expect(label).toHaveBeenCalledWith('203.0.113.10', '회사 사무실'),
  );
});

it('차단 범위를 SSH 만으로 바꿀 때 확인을 받는다', async () => {
  signIn([PERMISSIONS.SECURITY_READ, PERMISSIONS.SECURITY_MANAGE]);
  vi.spyOn(securityService, 'getSshAccess').mockResolvedValue(overview());
  const scope = vi
    .spyOn(securityService, 'setSshBlockScope')
    .mockResolvedValue(undefined);
  renderPanel();

  expect(await screen.findByText('SSH·사이트')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'SSH 만' }));
  const dialog = await screen.findByRole('alertdialog');
  await userEvent.click(within(dialog).getByRole('button', { name: '확인' }));
  await waitFor(() =>
    expect(scope).toHaveBeenCalledWith('222.99.122.102', 'ssh'),
  );
});

it('긴 차단 목록은 10개씩 쪽으로 나눈다', async () => {
  signIn([PERMISSIONS.SECURITY_READ, PERMISSIONS.SECURITY_MANAGE]);
  const data = overview();
  data.blocks = Array.from({ length: 23 }, (_, i) => ({
    ip: `5.5.5.${i + 1}`,
    source: 'auto' as const,
    blockedAt: '2026-11-11 09:00:00',
    reason: 'root 시도',
    scope: 'all' as const,
    geo: null,
  }));
  vi.spyOn(securityService, 'getSshAccess').mockResolvedValue(data);
  renderPanel();

  expect(await screen.findByText('5.5.5.1')).toBeInTheDocument();
  expect(screen.queryByText('5.5.5.11')).toBeNull();
  expect(screen.getByText('23개 중 1/3쪽')).toBeInTheDocument();
  await userEvent.click(screen.getAllByRole('button', { name: '다음 쪽' })[0]);
  expect(screen.getByText('5.5.5.11')).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('차단 목록 찾기'), '5.5.5.23');
  expect(screen.getByText('5.5.5.23')).toBeInTheDocument();
  expect(screen.queryByText('5.5.5.11')).toBeNull();
});

it('허용 국가를 보여 주고 나라를 빼기 전에 확인을 받는다', async () => {
  signIn([PERMISSIONS.SECURITY_READ, PERMISSIONS.SECURITY_MANAGE]);
  vi.spyOn(securityService, 'getSshAccess').mockResolvedValue(overview());
  const update = vi
    .spyOn(securityService, 'updateSshCountryGuard')
    .mockResolvedValue(undefined);
  renderPanel();

  expect(
    await screen.findByText(/허용 국가 밖 SSH 차단 · 켜짐/),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/허용 국가 JP\(.+\), KR\(.+\) 밖에서/),
  ).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'JP 허용 해제' }));
  expect(update).not.toHaveBeenCalled();
  const dialog = await screen.findByRole('alertdialog');
  await userEvent.click(within(dialog).getByRole('button', { name: '확인' }));
  await waitFor(() =>
    expect(update).toHaveBeenCalledWith({ allowedCountries: ['KR'] }),
  );

  await userEvent.type(screen.getByLabelText('허용할 국가 코드'), 'us');
  await userEvent.click(screen.getByRole('button', { name: '허용' }));
  await waitFor(() =>
    expect(update).toHaveBeenCalledWith({
      allowedCountries: ['JP', 'KR', 'US'],
    }),
  );
  await userEvent.click(screen.getByRole('button', { name: '끄기' }));
  await waitFor(() => expect(update).toHaveBeenCalledWith({ enabled: false }));
});

it('다시 허용한 나라에 남은 차단 수를 알리고 한 번에 풀 수 있다', async () => {
  signIn([PERMISSIONS.SECURITY_READ, PERMISSIONS.SECURITY_MANAGE]);
  const data = overview();
  data.countryGuard.blockedByCountry = [
    { country: 'JP', countryName: '일본', count: 3 },
    { country: 'CN', countryName: '중국', count: 5 },
  ];
  vi.spyOn(securityService, 'getSshAccess').mockResolvedValue(data);
  const unblock = vi
    .spyOn(securityService, 'unblockSshCountry')
    .mockResolvedValue(undefined);
  renderPanel();

  expect(
    await screen.findByText(/JP 를 허용했지만 이 규칙이 막아 둔 IP 3개/),
  ).toBeInTheDocument();
  expect(screen.queryByText(/CN 를 허용했지만/)).toBeNull();
  await userEvent.click(
    screen.getByRole('button', { name: '이 나라 차단 모두 해제' }),
  );
  const dialog = await screen.findByRole('alertdialog');
  await userEvent.click(within(dialog).getByRole('button', { name: '확인' }));
  await waitFor(() => expect(unblock).toHaveBeenCalledWith('JP'));
});

it('보기 권한만 있으면 국가 설정을 바꾸는 버튼을 숨긴다', async () => {
  signIn([PERMISSIONS.SECURITY_READ]);
  vi.spyOn(securityService, 'getSshAccess').mockResolvedValue(overview());
  renderPanel();

  await screen.findByText(/허용 국가 밖 SSH 차단 · 켜짐/);
  expect(screen.queryByRole('button', { name: '끄기' })).toBeNull();
  expect(screen.queryByLabelText('허용할 국가 코드')).toBeNull();
});
