// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RemoteDesktopPage from './index';

const fixture = vi.hoisted(() => ({
  auth: {
    user: { roles: ['admin'] },
    token: 'test-token',
    impersonation: false,
  },
  post: vi.fn(),
  get: vi.fn().mockResolvedValue({ data: [] }),
  paste: vi.fn(),
  credentials: vi.fn(),
  disconnect: vi.fn(),
  clients: [] as EventTarget[],
  options: undefined as unknown,
}));
vi.mock('@/shared/model/auth.store', () => ({
  useAuthStore: () => fixture.auth,
}));
vi.mock('@/shared/api', () => ({
  api: { post: fixture.post, get: fixture.get },
}));
vi.mock('@novnc/novnc', () => ({
  default: class extends EventTarget {
    constructor(...args: unknown[]) {
      super();
      fixture.options = args[2];
      fixture.clients.push(this);
    }
    disconnect = fixture.disconnect;
    clipboardPasteFrom = fixture.paste;
    sendCredentials = fixture.credentials;
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  fixture.auth.user.roles = ['admin'];
  fixture.auth.impersonation = false;
  fixture.clients.length = 0;
});

function show() {
  return render(
    <MemoryRouter>
      <RemoteDesktopPage />
    </MemoryRouter>,
  );
}

describe('원격 데스크톱 화면', () => {
  it('연결 요청 중 취소하면 HTTP를 중단하고 늦은 응답으로 소켓을 만들지 않는다', async () => {
    let complete: ((value: { data: { ticket: string } }) => void) | undefined;
    fixture.post.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    show();
    fireEvent.click(screen.getByRole('button', { name: '연결' }));
    const signal: AbortSignal = fixture.post.mock.calls[0][2].signal;
    fireEvent.click(screen.getByRole('button', { name: '연결 종료' }));
    expect(signal.aborted).toBe(true);
    await act(async () => {
      complete?.({ data: { ticket: 'late' } });
    });
    expect(fixture.clients).toHaveLength(0);
  });

  it('페이지 이탈 시 열린 원격 연결을 정리한다', async () => {
    fixture.post.mockResolvedValue({ data: { ticket: 'test' } });
    show();
    fireEvent.click(screen.getByRole('button', { name: '연결' }));
    await waitFor(() => expect(fixture.clients).toHaveLength(1));
    act(() => window.dispatchEvent(new Event('pagehide')));
    expect(fixture.disconnect).toHaveBeenCalledTimes(1);
    act(() => fixture.clients[0].dispatchEvent(new Event('connect')));
    expect(screen.getByRole('button', { name: '연결' })).toBeTruthy();
  });
  it('저장된 계정은 연결할 때만 VNC 인증에 전달한다', async () => {
    fixture.post.mockResolvedValue({
      data: {
        ticket: 'test-ticket',
        credentials: { username: 'test-user', password: 'test-password' },
      },
    });
    show();
    expect(fixture.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '연결' }));
    await waitFor(() => expect(fixture.clients).toHaveLength(1));
    expect(fixture.post.mock.calls[0][0]).toBe(
      '/remote-desktop/targets/local/ticket',
    );
    expect(fixture.options).toMatchObject({
      credentials: {
        username: 'test-user',
        password: 'test-password',
        target: '',
      },
    });
    expect(screen.queryByDisplayValue('test-password')).toBeNull();
  });
  it('일반 사용자에게 연결 버튼을 노출하지 않는다', () => {
    fixture.auth.user.roles = ['guest'];
    show();
    expect(screen.queryByRole('button', { name: '연결' })).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('관리자 본인');
  });

  it('인증 카드에 설치별 기본 계정을 채우고 암호만 전송 후 지운다', async () => {
    fixture.post.mockResolvedValue({
      data: { ticket: 'test', suggestedUsername: 'default-user' },
    });
    show();
    fireEvent.click(screen.getByRole('button', { name: '연결' }));
    await waitFor(() => expect(fixture.clients).toHaveLength(1));
    act(() =>
      fixture.clients[0].dispatchEvent(new Event('credentialsrequired')),
    );
    expect(screen.getByDisplayValue('default-user')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('인증해 주세요');
    fireEvent.change(screen.getByLabelText('화면 공유 암호'), {
      target: { value: 'private-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: '인증' }));
    expect(fixture.credentials).toHaveBeenCalledWith({
      username: 'default-user',
      password: 'private-password',
      target: '',
    });
    expect(screen.queryByDisplayValue('private-password')).toBeNull();
  });

  it('다른 컴퓨터를 선택한 뒤 재연결해도 선택한 대상을 유지한다', async () => {
    fixture.get.mockResolvedValueOnce({
      data: [
        { id: 'second', name: '작업 PC', port: 5901, hasCredentials: false },
      ],
    });
    fixture.post.mockResolvedValue({ data: { ticket: 'test' } });
    show();
    fireEvent.click(screen.getByRole('button', { name: '접속 대상' }));
    fireEvent.click(
      await screen.findByRole('button', { name: '작업 PC · 연결' }),
    );
    await waitFor(() => expect(fixture.clients).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: '연결 종료' }));
    fireEvent.click(screen.getByRole('button', { name: '연결' }));
    await waitFor(() => expect(fixture.clients).toHaveLength(2));
    expect(fixture.post.mock.calls.map((call) => call[0])).toEqual([
      '/remote-desktop/targets/second/ticket',
      '/remote-desktop/targets/second/ticket',
    ]);
  });

  it('관리자도 사용자 미리보기에서는 접속할 수 없다', () => {
    fixture.auth.impersonation = true;
    show();
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(fixture.post).not.toHaveBeenCalled();
  });

  it('서버 요청 실패를 한글로 표시하고 다시 연결할 수 있다', async () => {
    fixture.post.mockRejectedValue(new Error('offline'));
    show();
    fireEvent.click(screen.getByRole('button', { name: '연결' }));
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain(
        '연결할 수 없습니다',
      ),
    );
    expect(
      screen.getByRole('button', { name: '연결' }).hasAttribute('disabled'),
    ).toBe(false);
  });

  it('클립보드는 명시적으로 전송하고 화면을 닫으면 연결을 정리한다', async () => {
    fixture.post.mockResolvedValue({ data: { ticket: 'one-time-ticket' } });
    const page = show();
    fireEvent.click(screen.getByRole('button', { name: '연결' }));
    await waitFor(() => expect(fixture.clients).toHaveLength(1));
    act(() => {
      fixture.clients[0].dispatchEvent(new Event('connect'));
    });
    fireEvent.click(screen.getByRole('button', { name: '클립보드' }));
    fireEvent.change(screen.getByLabelText('클립보드 텍스트'), {
      target: { value: '한글 텍스트' },
    });
    expect(fixture.paste).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '맥으로 보내기' }));
    expect(fixture.paste).toHaveBeenCalledWith('한글 텍스트');
    expect(
      screen.queryByRole('complementary', { name: '접속 대상 관리' }),
    ).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '도구 접기' }));
    expect(fixture.disconnect).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '화면 복원' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '화면 복원' }));
    expect(fixture.clients).toHaveLength(1);
    fireEvent.click(screen.getByRole('checkbox', { name: '보기 전용' }));
    fireEvent.click(screen.getByRole('button', { name: '클립보드' }));
    expect(
      screen
        .getByRole('button', { name: '맥으로 보내기' })
        .hasAttribute('disabled'),
    ).toBe(true);
    page.unmount();
    expect(fixture.disconnect).toHaveBeenCalled();
  });
});
