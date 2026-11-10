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
    knownIps: ['203.0.113.10'],
    blocks: [
      {
        ip: '222.99.122.102',
        source: 'auto',
        blockedAt: '2026-11-10 17:56:05',
        reason: 'root 시도',
      },
    ],
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
