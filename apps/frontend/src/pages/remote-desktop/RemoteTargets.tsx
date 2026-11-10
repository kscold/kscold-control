import { useEffect, useState } from 'react';
import { api } from '@/shared/api';

interface Target {
  id: string;
  name: string;
  port: number;
  hasCredentials: boolean;
}
const emptyForm = {
  name: '',
  port: 5901,
  username: '',
  password: '',
  saveCredentials: true,
};
const button = 'desktop-button';

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
        if (active) setTargets(data);
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
        기본 대상은 맥미니입니다. 다른 컴퓨터는 SSH 터널의 로컬 포트로
        등록하세요. 암호는 서버에 암호화하여 보관하며 연결 시에만 사용합니다.
      </p>
      <div className="grid gap-3">
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
            <p className="my-1 text-xs text-gray-500">
              로컬 포트 {target.port}
              {target.id === 'local' ? ' · 기본 대상' : ''}
            </p>
            <button
              className={button}
              disabled={busy || disabled}
              onClick={() => {
                setForm({ ...emptyForm, name: target.name, port: target.port });
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
          className="mt-3 grid gap-2 sm:grid-cols-2"
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
          <label>
            로컬 연결 포트
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
