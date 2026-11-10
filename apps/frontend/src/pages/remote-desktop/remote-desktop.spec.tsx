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
  paste: vi.fn(),
  disconnect: vi.fn(),
  clients: [] as EventTarget[],
}));
vi.mock('@/shared/model/auth.store', () => ({
  useAuthStore: () => fixture.auth,
}));
vi.mock('@/shared/api', () => ({ api: { post: fixture.post } }));
vi.mock('@novnc/novnc', () => ({
  default: class extends EventTarget {
    constructor() {
      super();
      fixture.clients.push(this);
    }
    disconnect = fixture.disconnect;
    clipboardPasteFrom = fixture.paste;
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
  it('일반 사용자에게 연결 버튼을 노출하지 않는다', () => {
    fixture.auth.user.roles = ['guest'];
    show();
    expect(screen.queryByRole('button', { name: '연결' })).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('관리자 본인');
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
    fireEvent.change(screen.getByLabelText('클립보드 텍스트'), {
      target: { value: '한글 텍스트' },
    });
    expect(fixture.paste).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '맥으로 보내기' }));
    expect(fixture.paste).toHaveBeenCalledWith('한글 텍스트');
    fireEvent.click(screen.getByRole('checkbox', { name: '보기 전용' }));
    expect(
      screen
        .getByRole('button', { name: '맥으로 보내기' })
        .hasAttribute('disabled'),
    ).toBe(true);
    page.unmount();
    expect(fixture.disconnect).toHaveBeenCalled();
  });
});
