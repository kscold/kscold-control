import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NetworkDashboard } from './NetworkDashboard';
import { networkService } from '../api/network.service';
import { useAuthStore } from '@/shared/model/auth.store';
import { useModalStore } from '@/shared/model/modal.store';
import { Modal } from '@/shared/ui/Modal';
import { ApiError } from '@/shared/api/api-error';

const entry = {
  publicPort: 8080,
  privatePort: 80,
  protocol: 'TCP' as const,
  description: 'Example service',
  enabled: true,
  ttl: 0,
  privateHost: '192.0.2.2',
  local: false,
};
const user = {
  id: 'test-user',
  email: 'test@example.com',
  roles: ['admin'],
  permissions: ['system:read', 'system:write'],
};

describe('네트워크 상태와 복구 UX', () => {
  beforeEach(() => {
    useAuthStore.setState({ user, impersonation: null });
    useModalStore.getState().close();
    vi.spyOn(networkService, 'getMappings').mockResolvedValue([entry]);
    vi.spyOn(networkService, 'getExternalIp').mockResolvedValue('203.0.113.1');
    vi.spyOn(networkService, 'addMapping').mockResolvedValue();
    vi.spyOn(networkService, 'removeMapping').mockResolvedValue();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('조회 실패는 0개 대신 확인 불가로 안내하고 다시 조회하면 두 상태 모두 회복함', async () => {
    vi.mocked(networkService.getMappings).mockRejectedValueOnce(
      new ApiError('게이트웨이 연결 불가', 503, 'UPNP_UNAVAILABLE'),
    );
    vi.mocked(networkService.getExternalIp).mockRejectedValueOnce(
      new ApiError('게이트웨이 연결 불가', 503, 'UPNP_UNAVAILABLE'),
    );
    render(<NetworkDashboard />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '기존 설정은 변경하지 않았습니다',
    );
    expect(screen.getAllByText('확인 불가')).toHaveLength(2);
    expect(screen.queryByText('0개')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '포트 매핑 추가' }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '다시 조회' }));
    expect(await screen.findByText('203.0.113.1')).toBeVisible();
    expect(screen.getByText('1개')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(networkService.getMappings).toHaveBeenCalledTimes(2);
    expect(networkService.getExternalIp).toHaveBeenCalledTimes(2);
  });

  it('재조회 실패 시 기존 목록에 이전 결과 표시를 붙이고 변경을 잠금', async () => {
    render(<NetworkDashboard />);
    await screen.findByText('Example service');
    vi.mocked(networkService.getMappings).mockRejectedValueOnce(
      new Error('일시적 연결 실패'),
    );
    fireEvent.click(screen.getByRole('button', { name: '상태 새로고침' }));
    await screen.findByRole('alert');
    expect(screen.getByText('Example service')).toBeVisible();
    expect(
      screen.getByText(
        '이전 조회 결과입니다. 상태 확인 전까지 변경 작업이 잠깁니다.',
      ),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'TCP 8080 매핑 삭제' }),
    ).toBeDisabled();
  });

  it('읽기 전용 사용자에게 추가·삭제 작업을 표시하지 않음', async () => {
    useAuthStore.setState({ user: { ...user, permissions: ['system:read'] } });
    render(<NetworkDashboard />);
    await screen.findByText('Example service');
    expect(screen.getByText(/읽기 전용/)).toBeVisible();
    expect(
      screen.queryByRole('button', { name: '포트 매핑 추가' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /매핑 삭제/ }),
    ).not.toBeInTheDocument();
    expect(networkService.removeMapping).not.toHaveBeenCalled();
  });

  it('권한이 있어도 사용자 미리보기에서는 변경 작업이 표시되지 않음', async () => {
    useAuthStore.setState({
      user: {
        ...user,
        impersonation: {
          sessionId: 'preview',
          actorId: 'admin',
          actorEmail: 'admin@example.com',
          expiresAt: '2099-01-01',
          readOnly: true,
        },
      },
    });
    render(<NetworkDashboard />);
    await screen.findByText('Example service');
    expect(
      screen.queryByRole('button', { name: '포트 매핑 추가' }),
    ).not.toBeInTheDocument();
  });

  it('일부 성공과 빈 목록을 구별하고 임의 공유기 주소를 링크하지 않음', async () => {
    vi.mocked(networkService.getMappings).mockResolvedValue([]);
    vi.mocked(networkService.getExternalIp).mockRejectedValue(
      new Error('외부 IP 미지원'),
    );
    render(<NetworkDashboard />);
    await screen.findByText('등록된 UPnP 동적 포트 매핑이 없습니다.');
    expect(screen.getByText('0개')).toBeVisible();
    expect(
      screen.getByRole('button', { name: '포트 매핑 추가' }),
    ).toBeEnabled();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('클립보드 실패를 성공으로 알리지 않음', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    render(
      <>
        <NetworkDashboard />
        <Modal />
      </>,
    );
    await screen.findByText('203.0.113.1');
    fireEvent.click(screen.getByRole('button', { name: '외부 IP 복사' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent(
      '복사 실패',
    );
  });

  it('정수가 아닌 포트는 요청하지 않고 안내함', async () => {
    render(
      <>
        <NetworkDashboard />
        <Modal />
      </>,
    );
    await screen.findByText('Example service');
    fireEvent.click(screen.getByRole('button', { name: '포트 매핑 추가' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('외부 포트'), {
      target: { value: '80.5' },
    });
    fireEvent.change(within(dialog).getByLabelText('내부 포트'), {
      target: { value: '80' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: '추가' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent(
      '유효한 포트 번호',
    );
    expect(networkService.addMapping).not.toHaveBeenCalled();
  });

  it('화면 이동 시 진행 중 조회를 중단함', async () => {
    vi.mocked(networkService.getMappings).mockImplementation(
      () => new Promise(() => {}),
    );
    vi.mocked(networkService.getExternalIp).mockImplementation(
      () => new Promise(() => {}),
    );
    const { unmount } = render(<NetworkDashboard />);
    const mappingSignal = vi.mocked(networkService.getMappings).mock
      .calls[0][0]!;
    const ipSignal = vi.mocked(networkService.getExternalIp).mock.calls[0][0]!;
    unmount();
    expect(mappingSignal.aborted).toBe(true);
    expect(ipSignal.aborted).toBe(true);
  });
});
