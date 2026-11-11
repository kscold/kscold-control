import { useEffect, useRef, useState } from 'react';
import { api } from '@/shared/api';

interface Target {
  id: string;
  name: string;
  port: number;
  hasCredentials: boolean;
  host: string | null;
  wakeMac: string | null;
  protocol?: 'vnc' | 'rdp';
}
const emptyForm = {
  name: '',
  port: 5901,
  username: '',
  password: '',
  saveCredentials: true,
  host: '',
  wakeMac: '',
  protocol: 'vnc' as 'vnc' | 'rdp',
};
const button = 'desktop-button';
// 켜지는 데 보통 1분 안팎이라 5초 간격으로 2분까지 확인함.
const WAKE_POLL_MS = 5_000;
const WAKE_LIMIT_MS = 120_000;

export function RemoteTargets({
  onConnect,
  disabled,
}: {
  onConnect: (id: string, name: string) => void;
  disabled: boolean;
}) {
  const [targets, setTargets] = useState<Target[]>([]);
  const [editing, setEditing] = useState<{ id?: string } | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [online, setOnline] = useState<Record<string, boolean>>({});
  const [waking, setWaking] = useState<Record<string, string>>({});
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending) clearTimeout(timer);
    };
  }, []);

  const probe = async (id: string) => {
    try {
      const { data } = await api.get<{ online: boolean }>(
        `/remote-desktop/targets/${encodeURIComponent(id)}/status`,
        { timeout: 10_000 },
      );
      setOnline((current) => ({ ...current, [id]: data.online }));
      return data.online;
    } catch {
      return false;
    }
  };

  async function wake(target: Target) {
    setError('');
    setWaking((current) => ({ ...current, [target.id]: '깨우는 중' }));
    try {
      await api.post(
        `/remote-desktop/targets/${encodeURIComponent(target.id)}/wake`,
        undefined,
        { timeout: 10_000 },
      );
    } catch {
      setWaking(({ [target.id]: _, ...rest }) => rest);
      setError('깨우기 신호를 보내지 못했습니다. 잠시 뒤 다시 시도하세요.');
      return;
    }
    const started = Date.now();
    const poll = async () => {
      if (await probe(target.id)) {
        setWaking(({ [target.id]: _, ...rest }) => rest);
        return;
      }
      const elapsed = Date.now() - started;
      if (elapsed >= WAKE_LIMIT_MS) {
        setWaking(({ [target.id]: _, ...rest }) => rest);
        setError(`${target.name}이(가) 2분 안에 켜지지 않았습니다.`);
        return;
      }
      setWaking((current) => ({
        ...current,
        [target.id]: `켜지기를 기다리는 중 · ${Math.round(elapsed / 1000)}초`,
      }));
      const timer = setTimeout(() => {
        timers.current.delete(timer);
        void poll();
      }, WAKE_POLL_MS);
      timers.current.add(timer);
    };
    await poll();
  }

  const refresh = async () => {
    const { data } = await api.get<Target[]>('/remote-desktop/targets', {
      timeout: 10_000,
    });
    setTargets(data);
  };

  useEffect(() => {
    let active = true;
    void api
      .get<Target[]>('/remote-desktop/targets', { timeout: 10_000 })
      .then(({ data }) => {
        if (!active) return;
        setTargets(data);
        for (const target of data) void probe(target.id);
      })
      .catch(() => {
        if (active) setError('저장된 원격 대상 목록을 불러오지 못했습니다.');
      });
    return () => {
      active = false;
    };
  }, []);

  const closeForm = () => {
    setEditing(null);
    setForm(emptyForm);
  };

  async function save() {
    if (!editing) return;
    setBusy(true);
    setError('');
    try {
      if (editing.id)
        await api.put(
          `/remote-desktop/targets/${encodeURIComponent(editing.id)}`,
          form,
          { timeout: 10_000 },
        );
      else await api.post('/remote-desktop/targets', form, { timeout: 10_000 });
      closeForm();
      await refresh();
    } catch {
      setError('저장하지 못했습니다. 입력값과 관리자 권한을 확인하세요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="원격 접속 대상" className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">원격 접속 대상</h2>
        <button
          className={button}
          disabled={busy || disabled}
          onClick={() => {
            setForm(emptyForm);
            setEditing({});
          }}
        >
          대상 추가
        </button>
      </div>
      <p className="my-2 text-xs text-gray-400">
        기본 대상은 맥미니입니다. 같은 망의 다른 컴퓨터는 사설 IP 주소로, 망
        밖의 컴퓨터는 SSH 터널의 로컬 포트로 등록하세요. MAC 주소를 넣으면 꺼진
        PC를 깨울 수 있습니다. 암호는 서버에 암호화하여 보관하며 연결 시에만
        사용합니다.
      </p>
      <div className="grid grid-cols-1 gap-3">
        {targets.map((target) => (
          <div
            key={target.id}
            className="space-y-3 rounded-xl border border-gray-700 bg-gray-950/50 p-4"
          >
            <button
              className={`${button} w-full`}
              disabled={disabled || busy}
              onClick={() => onConnect(target.id, target.name)}
            >
              {target.name} ·{' '}
              {target.hasCredentials ? '저장된 계정으로 연결' : '연결'}
            </button>
            <p className="my-1 flex items-center gap-2 text-xs text-gray-500">
              <span
                role="img"
                aria-label={
                  online[target.id] === undefined
                    ? '상태 확인 중'
                    : online[target.id]
                      ? '켜짐'
                      : '꺼짐'
                }
                className={`inline-block h-2 w-2 rounded-full ${
                  online[target.id]
                    ? 'bg-emerald-400'
                    : online[target.id] === false
                      ? 'bg-gray-600'
                      : 'bg-gray-800'
                }`}
              />
              {target.host
                ? `${target.host}:${target.port}`
                : `로컬 포트 ${target.port}`}
              {target.protocol === 'rdp' ? ' · RDP' : ''}
              {target.id === 'local' ? ' · 기본 대상' : ''}
            </p>
            {target.wakeMac && (
              <button
                className={button}
                disabled={busy || disabled || Boolean(waking[target.id])}
                onClick={() => void wake(target)}
              >
                {waking[target.id] ?? '깨우기'}
              </button>
            )}
            <button
              className={button}
              disabled={busy || disabled}
              onClick={() => {
                setForm({
                  ...emptyForm,
                  name: target.name,
                  port: target.port,
                  host: target.host ?? '',
                  wakeMac: target.wakeMac ?? '',
                  protocol: target.protocol ?? 'vnc',
                });
                setEditing({ id: target.id });
              }}
            >
              접속 정보 변경
            </button>
            <button
              className={button}
              disabled={busy || disabled}
              onClick={async () => {
                if (
                  !window.confirm(
                    target.id === 'local'
                      ? '맥미니의 저장된 접속 정보를 지울까요? 기본 대상은 유지됩니다.'
                      : '원격 대상과 저장된 접속 정보를 삭제할까요?',
                  )
                )
                  return;
                setBusy(true);
                try {
                  await api.delete(
                    `/remote-desktop/targets/${encodeURIComponent(target.id)}`,
                  );
                  await refresh();
                } catch {
                  setError('원격 대상을 삭제하지 못했습니다.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              {target.id === 'local' ? '저장 정보 지우기' : '삭제'}
            </button>
          </div>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-amber-200">
          {error}
        </p>
      )}
      {editing && (
        <form
          className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <p className="text-xs text-gray-400 sm:col-span-2">
            변경 시 계정과 암호를 다시 입력하세요. 저장을 끄면 기존 계정·암호를
            삭제합니다. 모든 전체 관리자가 이 접속 정보를 사용할 수 있습니다.
          </p>
          <label>
            대상 이름
            <input
              required
              maxLength={80}
              className="block w-full rounded bg-gray-900 p-2"
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
            />
          </label>
          {editing.id !== 'local' && (
            <>
              <label>
                같은 망 주소 (사설 IPv4, 비우면 이 서버)
                <input
                  inputMode="decimal"
                  maxLength={15}
                  placeholder="10.0.0.x"
                  className="block w-full rounded bg-gray-900 p-2"
                  value={form.host}
                  onChange={(event) =>
                    setForm({ ...form, host: event.target.value })
                  }
                />
              </label>
              <label>
                연결 방식
                <select
                  className="block w-full rounded bg-gray-900 p-2"
                  value={form.protocol}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      protocol: event.target.value as 'vnc' | 'rdp',
                      port:
                        event.target.value === 'rdp' && form.port === 5901
                          ? 3389
                          : form.port,
                    })
                  }
                >
                  <option value="vnc">화면 공유 (VNC)</option>
                  <option value="rdp">Windows 원격 데스크톱 (RDP)</option>
                </select>
              </label>
              <label>
                깨우기용 MAC 주소 (선택)
                <input
                  maxLength={17}
                  placeholder="00:00:5E:00:53:01"
                  className="block w-full rounded bg-gray-900 p-2"
                  value={form.wakeMac}
                  onChange={(event) =>
                    setForm({ ...form, wakeMac: event.target.value })
                  }
                />
              </label>
            </>
          )}
          <label>
            연결 포트
            <input
              required
              type="number"
              min={1}
              max={65535}
              className="block w-full rounded bg-gray-900 p-2"
              value={form.port}
              onChange={(event) =>
                setForm({ ...form, port: Number(event.target.value) })
              }
            />
          </label>
          <label>
            원격 사용자 이름
            <input
              autoComplete="off"
              maxLength={255}
              className="block w-full rounded bg-gray-900 p-2"
              value={form.username}
              onChange={(event) =>
                setForm({ ...form, username: event.target.value })
              }
            />
          </label>
          <label>
            원격 암호
            <input
              type="password"
              autoComplete="new-password"
              maxLength={1024}
              required={form.saveCredentials}
              className="block w-full rounded bg-gray-900 p-2"
              value={form.password}
              onChange={(event) =>
                setForm({ ...form, password: event.target.value })
              }
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.saveCredentials}
              onChange={(event) =>
                setForm({ ...form, saveCredentials: event.target.checked })
              }
            />
            계정·암호 암호화 저장
          </label>
          <div className="flex gap-2">
            <button className={button} disabled={busy || disabled}>
              저장
            </button>
            <button
              type="button"
              className={button}
              disabled={busy}
              onClick={closeForm}
            >
              취소
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
