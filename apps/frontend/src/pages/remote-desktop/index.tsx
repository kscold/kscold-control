import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import RFB from '@novnc/novnc';
import { api } from '@/shared/api';
import { API_URL } from '@/shared/config';
import { ROLES } from '@/shared/config/roles';
import { useAuthStore } from '@/shared/model/auth.store';
import { RemoteTargets } from './RemoteTargets';

export default function RemoteDesktopPage() {
  const { user, token, impersonation } = useAuthStore();
  const allowed =
    !impersonation &&
    user?.roles.some(
      (role) => role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN,
    );
  const screen = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const client = useRef<RFB | null>(null);
  const generation = useRef(0);
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

  const disconnect = () => {
    generation.current += 1;
    const previous = client.current;
    client.current = null;
    previous?.disconnect();
    setStatus('idle');
    setPassword('');
    setClipboard('');
  };

  useEffect(() => {
    setStatus('idle');
    setPassword('');
    setClipboard('');
    return () => {
      generation.current += 1;
      client.current?.disconnect();
      client.current = null;
    };
  }, [token, allowed]);

  async function connect(targetId = 'local') {
    disconnect();
    const attempt = generation.current;
    setStatus('connecting');
    setMessage('보안 연결 중입니다.');
    try {
      const { data } = await api.post<{
        ticket: string;
        credentials?: { username: string; password: string };
      }>(
        `/remote-desktop/targets/${encodeURIComponent(targetId)}/ticket`,
        {},
        { timeout: 10_000 },
      );
      if (generation.current !== attempt || !screen.current) return;
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
        setMessage('연결됨 · 최대 15분 후 종료됩니다.');
        setPassword('');
      });
      rfb.addEventListener('credentialsrequired', () => {
        if (client.current === rfb) setStatus('credentials');
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
    }
  }

  if (!allowed)
    return (
      <div className="p-6" role="alert">
        원격 데스크톱은 관리자 본인 계정에서만 사용할 수 있습니다.
      </div>
    );

  const button =
    'rounded-lg border border-gray-700 px-3 py-2 text-sm disabled:opacity-40 hover:bg-gray-800';
  return (
    <div
      ref={frame}
      className="flex h-full flex-col gap-3 overflow-auto bg-gray-950 p-4 text-gray-100"
    >
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl font-semibold">원격 데스크톱</h1>
        <Link to="/terminal" className={button}>
          복구용 터미널
        </Link>
        <button
          className={button}
          disabled={status !== 'idle'}
          onClick={() => void connect()}
        >
          연결
        </button>
        <button
          className={button}
          disabled={status === 'idle'}
          onClick={disconnect}
        >
          연결 종료
        </button>
        <button
          className={button}
          onClick={() =>
            void frame.current
              ?.requestFullscreen()
              .catch(() =>
                setMessage('이 브라우저에서는 전체 화면을 사용할 수 없습니다.'),
              )
          }
        >
          전체 화면
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
      <RemoteTargets
        disabled={status !== 'idle'}
        onConnect={(id) => void connect(id)}
      />
      <p role="status" className="text-sm text-gray-400">
        {message}
      </p>
      {status === 'credentials' && (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            client.current?.sendCredentials({ username, password, target: '' });
            setPassword('');
            setStatus('connecting');
          }}
        >
          <input
            aria-label="맥 사용자 이름"
            autoComplete="off"
            className="rounded bg-gray-800 p-2"
            placeholder="맥 사용자 이름"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          <input
            aria-label="화면 공유 암호"
            type="password"
            autoComplete="off"
            className="rounded bg-gray-800 p-2"
            placeholder="화면 공유 암호"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button className={button}>인증</button>
        </form>
      )}
      <div
        ref={screen}
        className="min-h-64 flex-1 overflow-hidden rounded-xl border border-gray-800 bg-black"
      />
      <details className="rounded-xl border border-gray-800 p-3">
        <summary>텍스트 복사·붙여넣기</summary>
        <p className="my-2 text-xs text-gray-400">
          맥에서 복사한 텍스트가 여기에 표시됩니다. 전송 후 맥에서 ⌘V로
          붙여넣으세요. 한글 지원은 화면 공유 서버에 따라 다르며 파일 전송은
          지원하지 않습니다.
        </p>
        <textarea
          aria-label="클립보드 텍스트"
          maxLength={65536}
          className="w-full rounded bg-gray-900 p-2"
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
      </details>
    </div>
  );
}
