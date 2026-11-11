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
import {
  debounce,
  fitScale,
  keysymForChar,
  keysymForKey,
  remoteSizeFor,
  toRemotePoint,
} from './display-fit';

const fixture = vi.hoisted(() => ({
  auth: {
    user: { roles: ['admin'] },
    token: 'test-token',
    impersonation: false,
  },
  post: vi.fn(),
  put: vi.fn(),
  get: vi.fn().mockResolvedValue({ data: [] }),
  paste: vi.fn(),
  credentials: vi.fn(),
  disconnect: vi.fn(),
  clients: [] as EventTarget[],
  options: undefined as unknown,
  openRdp: vi.fn(),
}));
vi.mock('./rdp-client', () => ({ openRdp: fixture.openRdp }));
vi.mock('@/shared/model/auth.store', () => ({
  useAuthStore: () => fixture.auth,
}));
vi.mock('@/shared/api', () => ({
  api: { post: fixture.post, get: fixture.get, put: fixture.put },
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
      await screen.findByRole('button', { name: '작업 PC 연결' }),
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

  it('RDP 대상은 noVNC 대신 guacamole 터널로 열고 계정을 받지 않는다', async () => {
    fixture.get.mockResolvedValueOnce({
      data: [
        {
          id: 'windows',
          name: '윈도우 PC',
          port: 3389,
          hasCredentials: true,
          host: '10.0.0.5',
          wakeMac: null,
          protocol: 'rdp',
        },
      ],
    });
    fixture.post.mockResolvedValue({
      data: { ticket: 'rdp-ticket', protocol: 'rdp' },
    });
    fixture.openRdp.mockImplementation(() => ({
      disconnect: vi.fn(),
      clipboardPasteFrom: vi.fn(),
      viewOnly: false,
    }));
    show();
    fireEvent.click(screen.getByRole('button', { name: '접속 대상' }));
    fireEvent.click(
      await screen.findByRole('button', {
        name: '윈도우 PC 연결',
      }),
    );
    await waitFor(() => expect(fixture.openRdp).toHaveBeenCalledTimes(1));
    const [, url, ticket] = fixture.openRdp.mock.calls[0];
    expect(url).toMatch(/^ws:.*\/api\/remote-desktop\/guac$/);
    expect(ticket).toBe('rdp-ticket');
    expect(fixture.clients).toHaveLength(0);
  });

  it('깨우기 후 켜질 때까지 5초마다 상태를 확인한다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      let online = false;
      fixture.get.mockImplementation(async (path: string) =>
        path.endsWith('/status')
          ? { data: { online } }
          : {
              data: [
                {
                  id: 'windows',
                  name: '윈도우 PC',
                  port: 3389,
                  hasCredentials: false,
                  host: '10.0.0.5',
                  wakeMac: '00:00:5e:00:53:01',
                  protocol: 'rdp',
                },
              ],
            },
      );
      fixture.post.mockResolvedValue({ data: { sent: true } });
      show();
      fireEvent.click(screen.getByRole('button', { name: '접속 대상' }));
      fireEvent.click(await screen.findByRole('button', { name: /^깨우기/ }));
      const progress = await screen.findAllByRole('button', {
        name: /켜지기를 기다리는 중/,
      });
      expect(progress).toHaveLength(2);
      for (const button of progress) expect(button).toBeDisabled();
      expect(fixture.post).toHaveBeenCalledWith(
        '/remote-desktop/targets/windows/wake',
        undefined,
        expect.anything(),
      );
      online = true;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_000);
      });
      expect(
        await screen.findByRole('button', { name: /^깨우기/ }),
      ).toBeEnabled();
      expect(
        screen.getAllByRole('img', { name: '켜짐' }).length,
      ).toBeGreaterThan(0);
    } finally {
      fixture.get.mockReset();
      fixture.get.mockResolvedValue({ data: [] });
      vi.useRealTimers();
    }
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

  const windows = {
    id: 'windows',
    name: '윈도우 PC',
    port: 3389,
    hasCredentials: false,
    host: '10.0.0.5',
    wakeMac: null,
    protocol: 'rdp',
  };

  it('계정 없는 RDP 대상은 연결 대신 계정 입력 창을 열고 저장 뒤 연결한다', async () => {
    fixture.get.mockImplementation(async (path: string) =>
      path.endsWith('/status')
        ? { data: { online: true } }
        : { data: [windows] },
    );
    fixture.put.mockImplementation(async () => {
      fixture.get.mockImplementation(async (path: string) =>
        path.endsWith('/status')
          ? { data: { online: true } }
          : { data: [{ ...windows, hasCredentials: true }] },
      );
      return { data: { id: 'windows' } };
    });
    fixture.post.mockResolvedValue({ data: { ticket: 't', protocol: 'rdp' } });
    fixture.openRdp.mockImplementation(() => ({
      disconnect: vi.fn(),
      clipboardPasteFrom: vi.fn(),
      viewOnly: false,
    }));
    try {
      show();
      fireEvent.click(
        await screen.findByRole('button', { name: /계정 입력 후 연결/ }),
      );
      expect(fixture.post).not.toHaveBeenCalled();
      const dialog = screen.getByRole('dialog');
      expect(dialog.textContent).toContain('접속 계정 입력');
      const password = screen.getByLabelText('암호');
      expect(password.getAttribute('type')).toBe('password');
      fireEvent.click(screen.getByRole('button', { name: '암호 보기' }));
      expect(password.getAttribute('type')).toBe('text');
      fireEvent.click(screen.getByRole('button', { name: '저장하고 연결' }));
      expect(
        await screen.findByText('저장하려면 암호를 입력하세요.'),
      ).toBeTruthy();
      expect(fixture.put).not.toHaveBeenCalled();
      fireEvent.change(screen.getByLabelText('사용자 이름'), {
        target: { value: 'test-user' },
      });
      fireEvent.change(password, { target: { value: 'test-password' } });
      fireEvent.click(screen.getByRole('button', { name: '저장하고 연결' }));
      await waitFor(() => expect(fixture.openRdp).toHaveBeenCalledTimes(1));
      expect(fixture.put.mock.calls[0][0]).toBe(
        '/remote-desktop/targets/windows',
      );
      expect(fixture.put.mock.calls[0][1]).toMatchObject({
        username: 'test-user',
        password: 'test-password',
        saveCredentials: true,
        protocol: 'rdp',
        host: '10.0.0.5',
      });
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.getByText('윈도우 PC 저장됨 · 계정 저장됨')).toBeTruthy();
    } finally {
      fixture.get.mockReset();
      fixture.get.mockResolvedValue({ data: [] });
    }
  });

  it('대상 추가 창은 서버와 같은 규칙으로 주소·MAC 을 확인하고 포트를 바꿔 준다', async () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: '접속 대상' }));
    fireEvent.click(screen.getByRole('button', { name: '대상 추가' }));
    const port = screen.getByLabelText('포트') as HTMLInputElement;
    expect(port.value).toBe('5900');
    fireEvent.change(screen.getByLabelText('연결 방식'), {
      target: { value: 'rdp' },
    });
    expect(port.value).toBe('3389');
    fireEvent.change(screen.getByLabelText('이름'), {
      target: { value: '작업 PC' },
    });
    fireEvent.change(screen.getByLabelText('주소'), {
      target: { value: '203.0.113.5' },
    });
    fireEvent.change(screen.getByLabelText('MAC 주소'), {
      target: { value: 'zz:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(screen.getByText(/172.16~31/)).toBeTruthy();
    expect(screen.getByText(/같은 형식으로 입력하세요/)).toBeTruthy();
    expect(fixture.post).not.toHaveBeenCalled();
    fireEvent.change(port, { target: { value: '3390' } });
    fireEvent.change(screen.getByLabelText('연결 방식'), {
      target: { value: 'vnc' },
    });
    expect(port.value).toBe('3390');
  });

  it('저장 실패는 창 안에 서버 메시지로 보여 주고 입력을 유지한다', async () => {
    fixture.post.mockRejectedValue({
      response: {
        status: 400,
        data: { message: 'RDP 대상은 같은 망 주소를 입력하세요.' },
      },
    });
    show();
    fireEvent.click(screen.getByRole('button', { name: '접속 대상' }));
    fireEvent.click(screen.getByRole('button', { name: '대상 추가' }));
    fireEvent.change(screen.getByLabelText('이름'), {
      target: { value: '작업 PC' },
    });
    fireEvent.change(screen.getByLabelText('암호'), {
      target: { value: 'test-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    const alert = await screen.findByText(
      'RDP 대상은 같은 망 주소를 입력하세요.',
    );
    expect(alert.closest('[role="dialog"]')).toBeTruthy();
    expect((screen.getByLabelText('이름') as HTMLInputElement).value).toBe(
      '작업 PC',
    );
  });

  it('계정이 저장된 대상은 암호를 비워도 저장하고 저장됨을 알린다', async () => {
    fixture.get.mockResolvedValue({
      data: [{ ...windows, hasCredentials: true }],
    });
    fixture.put.mockResolvedValue({ data: { id: 'windows' } });
    try {
      show();
      fireEvent.click(screen.getByRole('button', { name: '접속 대상' }));
      expect(await screen.findByText('계정 저장됨')).toBeTruthy();
      fireEvent.click(
        screen.getByRole('button', { name: '윈도우 PC 더 보기' }),
      );
      fireEvent.click(screen.getByRole('menuitem', { name: '편집' }));
      expect(
        screen.getByLabelText('암호').getAttribute('placeholder'),
      ).toContain('저장된 암호 유지');
      fireEvent.click(screen.getByRole('button', { name: '저장' }));
      await waitFor(() => expect(fixture.put).toHaveBeenCalledTimes(1));
      expect(fixture.put.mock.calls[0][1]).toMatchObject({
        password: '',
        saveCredentials: true,
      });
      expect(await screen.findByText(/윈도우 PC 저장됨/)).toBeTruthy();
    } finally {
      fixture.get.mockReset();
      fixture.get.mockResolvedValue({ data: [] });
    }
  });

  it('RDP 가 붙기 전에 끊기면 확인할 원인을 보여 준다', async () => {
    fixture.get.mockResolvedValue({
      data: [{ ...windows, hasCredentials: true }],
    });
    fixture.post.mockResolvedValue({ data: { ticket: 't', protocol: 'rdp' } });
    let events: { onDisconnect: () => void } | undefined;
    fixture.openRdp.mockImplementation((_s, _u, _t, handlers) => {
      events = handlers;
      return {
        disconnect: vi.fn(),
        clipboardPasteFrom: vi.fn(),
        viewOnly: false,
      };
    });
    try {
      show();
      fireEvent.click(
        await screen.findByRole('button', { name: '화면 연결하기' }),
      );
      await waitFor(() => expect(events).toBeTruthy());
      act(() => events?.onDisconnect());
      const failure = screen.getByRole('alert');
      expect(failure.textContent).toContain('저장된 계정과 암호');
      expect(failure.textContent).toContain('켜져 있고');
      expect(failure.textContent).toContain('중계 서버');
    } finally {
      fixture.get.mockReset();
      fixture.get.mockResolvedValue({ data: [] });
    }
  });

  it('RDP 연결 뒤 화면 키보드 입력과 터치 방식 전환을 원격으로 넘긴다', async () => {
    fixture.get.mockResolvedValueOnce({
      data: [
        {
          id: 'windows',
          name: '윈도우 PC',
          port: 3389,
          hasCredentials: true,
          host: '10.0.0.5',
          wakeMac: null,
          protocol: 'rdp',
        },
      ],
    });
    fixture.post.mockResolvedValue({
      data: { ticket: 'rdp-ticket', protocol: 'rdp' },
    });
    const sendKeysym = vi.fn();
    const rdp = {
      disconnect: vi.fn(),
      clipboardPasteFrom: vi.fn(),
      sendKeysym,
      viewOnly: false,
      touchMode: 'touchpad',
    };
    fixture.openRdp.mockImplementation((_el, _url, _ticket, events) => {
      setTimeout(() => events.onConnect());
      return rdp;
    });
    show();
    fireEvent.click(screen.getByRole('button', { name: '접속 대상' }));
    fireEvent.click(
      await screen.findByRole('button', { name: '윈도우 PC 연결' }),
    );
    const keyboard = await screen.findByRole('button', { name: '화면 키보드' });
    const input = screen.getByLabelText('원격 키 입력') as HTMLInputElement;
    fireEvent.click(keyboard);
    expect(document.activeElement).toBe(input);
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.input(input, {
      target: { value: 'a가' },
      data: 'a가',
      inputType: 'insertText',
    });
    expect(input.value).toBe('');
    expect(sendKeysym.mock.calls.map((call) => call[0])).toEqual([
      0xff0d, 0x61, 0x0100ac00,
    ]);
    fireEvent.click(
      screen.getByRole('button', { name: '터치 방식: 터치패드' }),
    );
    expect(rdp.touchMode).toBe('touchscreen');
    expect(
      screen.getByRole('button', { name: '터치 방식: 직접 누르기' }),
    ).toBeTruthy();
  });

  it('좁은 화면에서도 도구 버튼은 아이콘만으로 이름을 유지한다', () => {
    show();
    for (const name of ['접속 대상', '클립보드', '전체 화면'])
      expect(screen.getByRole('button', { name })).toBeTruthy();
    expect(
      screen.getByRole('region', { name: '원격 화면' }).className,
    ).toContain('desktop-screen');
  });
});

describe('원격 화면 맞춤 계산', () => {
  it('비율을 지켜 영역 안에 들어가는 배율을 고른다', () => {
    expect(
      fitScale({ width: 800, height: 600 }, { width: 1600, height: 900 }),
    ).toBe(0.5);
    expect(
      fitScale({ width: 390, height: 700 }, { width: 1280, height: 800 }),
    ).toBeCloseTo(390 / 1280);
    expect(
      fitScale({ width: 2000, height: 1000 }, { width: 1000, height: 500 }),
    ).toBe(2);
    expect(
      fitScale({ width: 0, height: 0 }, { width: 1000, height: 500 }),
    ).toBe(1);
  });

  it('요청 해상도는 화소 밀도를 2배까지 반영하고 상한·짝수로 맞춘다', () => {
    expect(remoteSizeFor({ width: 1001, height: 701 }, 1)).toEqual({
      width: 1000,
      height: 700,
    });
    expect(remoteSizeFor({ width: 390, height: 700 }, 3)).toEqual({
      width: 780,
      height: 1400,
    });
    expect(remoteSizeFor({ width: 1920, height: 1080 }, 2)).toEqual({
      width: 2560,
      height: 1440,
    });
    expect(remoteSizeFor({ width: 0, height: 500 }, 1)).toBeNull();
  });

  it('축소된 화면 좌표를 원격 좌표로 되돌리고 범위 안에 묶는다', () => {
    const remote = { width: 1920, height: 1080 };
    expect(toRemotePoint(480, 270, 0.5, remote)).toEqual({ x: 960, y: 540 });
    expect(toRemotePoint(-5, 9999, 0.5, remote)).toEqual({ x: 0, y: 1079 });
  });

  it('해상도 요청은 마지막 변경 뒤 한 번만 보낸다', () => {
    vi.useFakeTimers();
    try {
      const run = vi.fn();
      const call = debounce(run, 300);
      call(1);
      vi.advanceTimersByTime(200);
      call(2);
      vi.advanceTimersByTime(299);
      expect(run).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(run).toHaveBeenCalledExactlyOnceWith(2);
      call(3);
      call.cancel();
      vi.advanceTimersByTime(500);
      expect(run).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('키 이름과 글자를 keysym 으로 바꾼다', () => {
    expect(keysymForKey('Backspace')).toBe(0xff08);
    expect(keysymForKey('a')).toBeUndefined();
    expect(keysymForChar('A')).toBe(0x41);
    expect(keysymForChar('é')).toBe(0xe9);
    expect(keysymForChar('한')).toBe(0x0100d55c);
  });
});
