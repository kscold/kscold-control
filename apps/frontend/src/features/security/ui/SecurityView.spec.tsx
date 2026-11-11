import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PERMISSIONS } from '@/shared/config/permissions';
import { useAuthStore, useModalStore } from '@/shared/model';
import { Modal } from '@/shared/ui/Modal';
import { securityService } from '../api/security.service';
import { SecurityView } from './SecurityView';

afterEach(() => {
  vi.restoreAllMocks();
  useModalStore.getState().close();
  window.localStorage.clear();
});

it('사이트 IP 차단 탭에 SSH 차단기가 사이트까지 막은 IP 를 같이 보여 주고 거기서 바꾼다', async () => {
  useAuthStore.setState({
    token: 'token',
    user: {
      id: 'u',
      email: 'a@example.com',
      roles: ['admin'],
      permissions: [PERMISSIONS.SECURITY_READ, PERMISSIONS.SECURITY_MANAGE],
    },
    impersonation: null,
    isValidating: false,
  });
  window.localStorage.setItem('security-tab', 'bans');
  vi.spyOn(securityService, 'listBans').mockResolvedValue([]);
  vi.spyOn(securityService, 'getFirewallBlocks').mockResolvedValue({
    guard: {
      installed: true,
      running: true,
      updatedAt: null,
      pfEnabled: true,
      blockedCount: 2,
      allCount: 1,
      sshOnlyCount: 1,
    },
    items: [
      {
        ip: '222.99.122.102',
        source: 'auto',
        blockedAt: '2026-11-11 09:21:15',
        reason: 'root 시도(root)',
        scope: 'all',
        geo: null,
      },
      {
        ip: '5.5.5.5',
        source: 'manual',
        blockedAt: '2026-11-11 09:30:00',
        reason: null,
        scope: 'ssh',
        geo: null,
      },
    ],
  });
  const scope = vi
    .spyOn(securityService, 'setSshBlockScope')
    .mockResolvedValue(undefined);
  render(
    <>
      <SecurityView />
      <Modal />
    </>,
  );

  expect(await screen.findByText('222.99.122.102')).toBeInTheDocument();
  expect(screen.queryByText('5.5.5.5')).toBeNull();
  expect(screen.getByText(/SSH 만 막는 IP 1개/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'SSH 만' }));
  const dialog = await screen.findByRole('alertdialog');
  await userEvent.click(within(dialog).getByRole('button', { name: '확인' }));
  await waitFor(() =>
    expect(scope).toHaveBeenCalledWith('222.99.122.102', 'ssh'),
  );
});

it('공격 지도 탭을 고르면 지도를 불러오고 다음에도 그 탭으로 연다', async () => {
  useAuthStore.setState({
    token: 'token',
    user: {
      id: 'u',
      email: 'a@example.com',
      roles: ['admin'],
      permissions: [PERMISSIONS.SECURITY_READ],
    },
    impersonation: null,
    isValidating: false,
  });
  window.localStorage.setItem('security-tab', 'bans');
  vi.spyOn(securityService, 'listBans').mockResolvedValue([]);
  vi.spyOn(securityService, 'getFirewallBlocks').mockRejectedValue(
    new Error('쓰지 않음'),
  );
  const map = vi.spyOn(securityService, 'getAttackMap').mockResolvedValue({
    enabled: false,
    reason: 'loading',
  });
  render(<SecurityView />);

  await userEvent.click(screen.getByRole('tab', { name: '공격 지도' }));
  expect(
    await screen.findByText(/IP 위치 파일을 읽는 중입니다/),
  ).toBeInTheDocument();
  expect(map).toHaveBeenCalledWith(7, expect.any(AbortSignal));
  expect(window.localStorage.getItem('security-tab')).toBe('map');
});
