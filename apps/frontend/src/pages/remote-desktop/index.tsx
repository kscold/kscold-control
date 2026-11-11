import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import RFB from '@novnc/novnc';
import {
  Monitor,
  ShieldCheck,
  Loader2,
  X,
  PanelsTopLeft,
  Clipboard,
  Maximize,
} from 'lucide-react';
import { api } from '@/shared/api';
import { API_URL } from '@/shared/config';
import { ROLES } from '@/shared/config/roles';
import { useAuthStore } from '@/shared/model/auth.store';
import { RemoteTargets } from './RemoteTargets';
import './remote-desktop.css';

// VNC(noVNC)와 RDP(guacamole) 연결이 화면에 내주는 공통 동작
interface DesktopClient {
  disconnect(): void;
  clipboardPasteFrom(text: string): void;
  viewOnly: boolean;
  sendCredentials?: RFB['sendCredentials'];
}

export default function RemoteDesktopPage() {
  const { user, token, impersonation } = useAuthStore();
  const allowed =
    !impersonation &&
    user?.roles.some(
      (role) => role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN,
    );
  const screen = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const client = useRef<DesktopClient | null>(null);
  const generation = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const [status, setStatus] = useState<
    'idle' | 'connecting' | 'credentials' | 'connected'
  >('idle');
  const [message, setMessage] = useState(
    '연결하면 맥미니의 실제 화면이 공유됩니다.',
  );
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [clipboard, setClipboard] = useState('');
  const [viewOnly, setViewOnly] = useState(false);
  const [focused, setFocused] = useState(false);
  const [targetsOpen, setTargetsOpen] = useState(false);
  const [clipboardOpen, setClipboardOpen] = useState(false);
  const [selected, setSelected] = useState({ id: 'local', name: '맥미니' });

  const restore = () => {
    setFocused(false);
    setClipboardOpen(false);
    setTargetsOpen(false);
    if (document.fullscreenElement === frame.current)
      void document.exitFullscreen().catch(() => {});
  };

  useEffect(() => {
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setTargetsOpen(false);
      setClipboardOpen(false);
      if (!document.fullscreenElement) setFocused(false);
    };
    document.addEventListener('keydown', dismiss);
    return () => document.removeEventListener('keydown', dismiss);
  }, []);

  useEffect(() => {
    const changed = () => {
      if (!document.fullscreenElement) setFocused(false);
    };
    document.addEventListener('fullscreenchange', changed);
    return () => document.removeEventListener('fullscreenchange', changed);
  }, []);

  const release = () => {
    generation.current += 1;
    pending.current?.abort();
    pending.current = null;
    const previous = client.current;
    client.current = null;
    previous?.disconnect();
  };

  const disconnect = () => {
    release();
    setStatus('idle');
    setFocused(false);
    setPassword('');
    setClipboard('');
  };

  useEffect(() => {
    setStatus('idle');
    setPassword('');
    setClipboard('');
    const leave = () => {
      release();
      setStatus('idle');
      setPassword('');
      setClipboard('');
      setMessage('페이지를 떠나 원격 연결을 종료했습니다. 다시 연결하세요.');
    };
    window.addEventListener('pagehide', leave);
    return () => {
      window.removeEventListener('pagehide', leave);
      release();
    };
  }, [token, allowed]);

  async function connect(target = selected) {
    disconnect();
    setSelected(target);
    setTargetsOpen(false);
    setClipboardOpen(false);
    setUsername('');
    const attempt = generation.current;
    const controller = new AbortController();
    pending.current = controller;
    setStatus('connecting');
    setMessage('보안 연결 중입니다.');
    try {
      const { data } = await api.post<{
        ticket: string;
        protocol?: 'vnc' | 'rdp';
        suggestedUsername?: string;
        credentials?: { username: string; password: string };
      }>(
        `/remote-desktop/targets/${encodeURIComponent(target.id)}/ticket`,
        {},
        { timeout: 10_000, signal: controller.signal },
      );
      if (generation.current !== attempt || !screen.current) return;
      if (data.protocol === 'rdp') {
        const { openRdp } = await import('./rdp-client');
        if (generation.current !== attempt || !screen.current) return;
        const guac = new URL(
          `${API_URL}/api/remote-desktop/guac`,
          window.location.origin,
        );
        guac.protocol = guac.protocol === 'https:' ? 'wss:' : 'ws:';
        const rdp: DesktopClient = openRdp(
          screen.current,
          guac.href,
          data.ticket,
          {
            onConnect: () => {
              if (client.current !== rdp) return;
              setStatus('connected');
              setMessage('연결됨 · 최대 15분 후 종료됩니다.');
            },
            onDisconnect: () => {
              if (client.current !== rdp) return;
              disconnect();
              setMessage(
                '연결이 종료되었습니다. 원격 데스크톱 설정과 저장된 계정을 확인한 뒤 다시 연결하세요.',
              );
            },
            onClipboard: (text) => {
              if (client.current === rdp) setClipboard(text);
            },
          },
        );
        client.current = rdp;
        rdp.viewOnly = viewOnly;
        return;
      }
      setUsername(data.credentials?.username ?? data.suggestedUsername ?? '');
      const url = new URL(
        `${API_URL}/api/remote-desktop/socket`,
        window.location.origin,
      );
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      const rfb = new RFB(screen.current, url.href, {
        shared: true,
        wsProtocols: ['binary', `ticket.${data.ticket}`],
        ...(data.credentials
          ? { credentials: { ...data.credentials, target: '' } }
          : {}),
      });
      client.current = rfb;
      rfb.scaleViewport = true;
      rfb.viewOnly = viewOnly;
      rfb.addEventListener('connect', () => {
        if (client.current !== rfb) return;
        setStatus('connected');
        setTargetsOpen(false);
        setClipboardOpen(false);
        setMessage('연결됨 · 최대 15분 후 종료됩니다.');
        setPassword('');
      });
      rfb.addEventListener('credentialsrequired', () => {
        if (client.current !== rfb) return;
        setStatus('credentials');
        setMessage('화면 공유 계정으로 인증해 주세요.');
      });
      rfb.addEventListener('clipboard', (event) => {
        if (client.current === rfb)
          setClipboard(event.detail.text.slice(0, 65536));
      });
      rfb.addEventListener('disconnect', () => {
        if (client.current !== rfb) return;
        disconnect();
        setMessage(
          '연결이 종료되었습니다. 화면 공유 설정·인증을 확인한 뒤 다시 연결하세요.',
        );
      });
      rfb.addEventListener('securityfailure', () => {
        if (client.current !== rfb) return;
        disconnect();
        setMessage('맥 화면 공유 인증에 실패했습니다.');
      });
    } catch {
      if (generation.current !== attempt) return;
      disconnect();
      setMessage(
        '연결할 수 없습니다. 관리자 권한과 서버의 원격 데스크톱 설정을 확인하세요.',
      );
    } finally {
      if (pending.current === controller) pending.current = null;
    }
  }

  if (!allowed)
    return (
      <div className="p-6" role="alert">
        원격 데스크톱은 관리자 본인 계정에서만 사용할 수 있습니다.
      </div>
    );

  const button = 'desktop-button';
  return (
    <div
      ref={frame}
      className={
        focused
          ? 'desktop-workspace fixed inset-0 z-[70] flex h-dvh flex-col overflow-hidden text-gray-100'
          : 'desktop-workspace relative flex h-full min-h-0 flex-col overflow-hidden text-gray-100'
      }
    >
      {focused && (
        <div className="absolute right-2 top-2 z-10 flex gap-1 rounded-lg border border-gray-700 bg-gray-950/90 p-1">
          <button
            className={button}
            onClick={() => setClipboardOpen(!clipboardOpen)}
            aria-expanded={clipboardOpen}
          >
            클립보드
          </button>
          <button className={button} onClick={restore}>
            화면 복원
          </button>
        </div>
      )}
      <header className={focused ? 'hidden' : 'desktop-toolbar'}>
        <div className="desktop-heading">
          <Monitor size={21} />
          <div>
            <h1>원격 데스크톱</h1>
            <span>
              {selected.name} ·{' '}
              {status === 'connected'
                ? '연결됨'
                : status === 'credentials'
                  ? '인증 필요'
                  : status === 'connecting'
                    ? '연결 중'
                    : '연결 대기'}
            </span>
          </div>
        </div>
        <button
          className={button}
          aria-expanded={targetsOpen}
          onClick={() => {
            setTargetsOpen(!targetsOpen);
            setClipboardOpen(false);
          }}
        >
          <PanelsTopLeft size={16} />
          접속 대상
        </button>
        <button
          className={button}
          aria-expanded={clipboardOpen}
          onClick={() => {
            setClipboardOpen(!clipboardOpen);
            setTargetsOpen(false);
          }}
        >
          <Clipboard size={16} />
          클립보드
        </button>
        <button
          className={`${button} desktop-primary`}
          hidden={status !== 'idle'}
          onClick={() => void connect()}
        >
          연결
        </button>
        <button
          className={button}
          hidden={status === 'idle'}
          onClick={disconnect}
        >
          연결 종료
        </button>
        <button
          className={button}
          onClick={() => {
            setFocused(true);
            if (frame.current?.requestFullscreen)
              void frame.current.requestFullscreen().catch(() => {
                setMessage(
                  '브라우저 전체 화면 대신 페이지 최대 화면을 사용합니다.',
                );
              });
          }}
        >
          <Maximize size={16} />
          전체 화면
        </button>
        <button className={button} onClick={() => setFocused(true)}>
          도구 접기
        </button>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={viewOnly}
            onChange={(event) => {
              setViewOnly(event.target.checked);
              if (client.current)
                client.current.viewOnly = event.target.checked;
            }}
          />
          보기 전용
        </label>
      </header>
      {targetsOpen && !focused && (
        <aside className="desktop-panel" aria-label="접속 대상 관리">
          <button
            className="desktop-panel-close"
            aria-label="접속 대상 닫기"
            onClick={() => setTargetsOpen(false)}
          >
            <X size={18} />
          </button>
          <RemoteTargets
            disabled={status !== 'idle'}
            onConnect={(id, name) => void connect({ id, name })}
          />
          <Link to="/terminal" className="desktop-recovery">
            연결 문제 해결 · 복구용 터미널
          </Link>
        </aside>
      )}
      <p role="status" className={focused ? 'sr-only' : 'desktop-status'}>
        {message}
      </p>
      <div className="desktop-stage">
        <div
          ref={screen}
          role="region"
          aria-label="원격 화면"
          className="absolute inset-0 overflow-hidden"
        />
        {status !== 'connected' && (
          <div className="desktop-overlay">
            <div className="desktop-connect-card">
              <div className="desktop-device-icon">
                <Monitor size={30} />
              </div>
              <p className="desktop-eyebrow">PRIVATE REMOTE WORKSPACE</p>
              <h2>{selected.name}</h2>
              <p className="desktop-card-description">
                {status === 'credentials'
                  ? '원격 컴퓨터의 화면 공유 계정으로 로그인하세요.'
                  : status === 'connecting'
                    ? '암호화된 연결을 준비하고 있습니다.'
                    : '브라우저에서 내 컴퓨터를 그대로 사용하세요.'}
              </p>
              {status === 'connecting' && (
                <Loader2
                  className="mx-auto my-6 animate-spin text-blue-400"
                  aria-label="연결 중"
                />
              )}
              {status === 'idle' && (
                <div className="desktop-idle-actions">
                  <button
                    className={`${button} desktop-primary`}
                    onClick={() => void connect()}
                  >
                    화면 연결하기
                  </button>
                  <button
                    className={button}
                    onClick={() => setTargetsOpen(true)}
                  >
                    다른 컴퓨터 선택
                  </button>
                </div>
              )}
              {status === 'credentials' && (
                <form
                  className="desktop-auth-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    client.current?.sendCredentials?.({
                      username,
                      password,
                      target: '',
                    });
                    setPassword('');
                    setStatus('connecting');
                    setMessage('계정을 확인하고 있습니다.');
                  }}
                >
                  <label>
                    사용자 이름
                    <input
                      aria-label="맥 사용자 이름"
                      autoComplete="off"
                      className="desktop-input"
                      placeholder="맥 사용자 이름"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                    />
                  </label>
                  <label>
                    암호
                    <input
                      aria-label="화면 공유 암호"
                      type="password"
                      autoComplete="off"
                      className="desktop-input"
                      autoFocus
                      required
                      placeholder="화면 공유 암호"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  </label>
                  <button className={`${button} desktop-primary`}>인증</button>
                </form>
              )}
              <p className="desktop-trust">
                <ShieldCheck size={14} />
                관리자 전용 · 최대 15분 세션
              </p>
            </div>
          </div>
        )}
      </div>
      {clipboardOpen && (
        <aside className="desktop-panel" aria-label="텍스트 복사·붙여넣기">
          <button
            className="desktop-panel-close"
            aria-label="클립보드 닫기"
            onClick={() => setClipboardOpen(false)}
          >
            <X size={18} />
          </button>
          <h2 className="text-lg font-semibold">텍스트 복사·붙여넣기</h2>
          <p className="my-2 text-xs text-gray-400">
            맥에서 복사한 텍스트가 여기에 표시됩니다. 전송 후 맥에서 ⌘V로
            붙여넣으세요. 한글 지원은 화면 공유 서버에 따라 다르며 파일 전송은
            지원하지 않습니다.
          </p>
          <textarea
            aria-label="클립보드 텍스트"
            maxLength={65536}
            className="desktop-input min-h-48 w-full"
            value={clipboard}
            onChange={(event) => setClipboard(event.target.value)}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              className={button}
              disabled={status !== 'connected' || viewOnly}
              onClick={() => client.current?.clipboardPasteFrom(clipboard)}
            >
              맥으로 보내기
            </button>
            <button
              className={button}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(clipboard);
                } catch {
                  setMessage(
                    '클립보드 권한이 없습니다. 텍스트를 선택해서 직접 복사하세요.',
                  );
                }
              }}
            >
              내 컴퓨터에 복사
            </button>
          </div>
        </aside>
      )}
    </div>
  );
}
