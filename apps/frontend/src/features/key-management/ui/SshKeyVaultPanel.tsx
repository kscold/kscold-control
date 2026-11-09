import { useCallback, useEffect, useState } from 'react';
import { Download, KeyRound, Loader2, Plus, Trash2 } from 'lucide-react';
import { sshKeyVaultService } from '../api/ssh-key-vault.service';
import type { SshKeySummary } from '../model/ssh-key.types';

const INPUT_CLASS =
  'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-amber-400 focus:outline-none';

function saveAsFile(fileName: string, content: string) {
  const url = URL.createObjectURL(
    new Blob([content], { type: 'application/octet-stream' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/** 서버 접속용 SSH 키 보관함. 전체 관리자가 아니면 목록을 받지 못해 표시하지 않는다. */
export function SshKeyVaultPanel() {
  const [keys, setKeys] = useState<SshKeySummary[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setKeys(await sshKeyVaultService.list());
    } catch {
      setKeys(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (id: string, action: () => Promise<void>) => {
    setBusy(id);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '요청에 실패했습니다.');
    } finally {
      setBusy(null);
    }
  };

  if (keys === null) return null;

  const submit = () =>
    run('create', async () => {
      await sshKeyVaultService.create({ name, description, privateKey });
      setName('');
      setDescription('');
      setPrivateKey('');
      setAdding(false);
      await load();
    });

  return (
    <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/45 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <KeyRound size={18} className="shrink-0 text-amber-300" />
            SSH 키 보관함
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            개인 키는 암호화해 저장합니다. 내려받으면 운영 감사에 기록됩니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding((value) => !value)}
          className="inline-flex shrink-0 items-center gap-2 self-start rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500 sm:self-auto"
        >
          <Plus size={14} />키 추가
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}

      {adding && (
        <div className="mt-4 grid grid-cols-1 gap-3">
          <input
            aria-label="키 이름"
            placeholder="키 이름 (예: pawpong-production)"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={`${INPUT_CLASS} font-mono`}
          />
          <input
            aria-label="설명"
            placeholder="설명"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className={INPUT_CLASS}
          />
          <textarea
            aria-label="개인 키"
            placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
            rows={6}
            spellCheck={false}
            autoComplete="off"
            value={privateKey}
            onChange={(event) => setPrivateKey(event.target.value)}
            className={`${INPUT_CLASS} font-mono text-xs`}
          />
          <button
            type="button"
            disabled={busy !== null || !name.trim() || !privateKey.trim()}
            onClick={() => void submit()}
            className="justify-self-start rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-slate-950 disabled:opacity-50"
          >
            저장
          </button>
        </div>
      )}

      <ul className="mt-4 divide-y divide-slate-800">
        {keys.length === 0 && (
          <li className="py-4 text-sm text-slate-500">등록된 키가 없습니다.</li>
        )}
        {keys.map((key) => (
          <li
            key={key.id}
            className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="break-all font-mono text-sm text-slate-100">
                {key.name}
              </p>
              {key.description && (
                <p className="text-xs text-slate-400">{key.description}</p>
              )}
              <p className="break-all font-mono text-[11px] text-slate-500">
                {key.fingerprint}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                disabled={busy !== null}
                aria-label={`${key.name} 내려받기`}
                onClick={() =>
                  void run(key.id, async () => {
                    const file = await sshKeyVaultService.download(key.id);
                    saveAsFile(file.fileName, file.privateKey);
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-500 disabled:opacity-50"
              >
                {busy === key.id ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Download size={13} />
                )}
                내려받기
              </button>
              <button
                type="button"
                disabled={busy !== null}
                aria-label={`${key.name} 삭제`}
                onClick={() => {
                  if (!window.confirm(`${key.name} 키를 삭제할까요?`)) return;
                  void run(key.id, async () => {
                    await sshKeyVaultService.remove(key.id);
                    await load();
                  });
                }}
                className="rounded-lg border border-slate-800 px-2.5 py-1.5 text-slate-400 hover:text-red-400 disabled:opacity-50"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
