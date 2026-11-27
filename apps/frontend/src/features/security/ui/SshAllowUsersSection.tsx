import { useEffect, useState } from 'react';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useModalStore } from '@/shared/model/modal.store';
import { FormError } from '@/shared/ui/FormError';
import { securityService } from '../api/security.service';
import { smallButton } from '../lib/paging';
import type {
  EditSshAllowUsersInput,
  SshAllowUsersPolicy,
} from '../model/security.types';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; policy: SshAllowUsersPolicy };

export function SshAllowUsersSection({ canManage }: { canManage: boolean }) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [revision, setRevision] = useState(0);
  const [user, setUser] = useState('');
  const [source, setSource] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const showConfirm = useModalStore((store) => store.showConfirm);

  const reload = () => {
    setState({ kind: 'loading' });
    setRevision((value) => value + 1);
  };

  const save = async (input: EditSshAllowUsersInput) => {
    setSaveError(null);
    setSaving(true);
    try {
      await securityService.editSshAllowUsers(input);
      if (input.kind === 'add') {
        setUser('');
        setSource('');
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '저장 실패');
    } finally {
      reload();
      setSaving(false);
    }
  };

  useEffect(() => {
    const request = new AbortController();
    void securityService.getSshAllowUsers(request.signal).then(
      (policy) => {
        if (!request.signal.aborted) setState({ kind: 'loaded', policy });
      },
      (error: unknown) => {
        if (!request.signal.aborted) {
          setState({
            kind: 'error',
            message: error instanceof Error ? error.message : '조회 실패',
          });
        }
      },
    );
    return () => request.abort();
  }, [revision]);

  if (state.kind === 'loading') {
    return (
      <p role="status" className="text-sm text-gray-400">
        불러오는 중
      </p>
    );
  }
  if (state.kind === 'error') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <p role="alert" className="text-sm text-amber-300">
          {state.message}
        </p>
        <button type="button" className={smallButton} onClick={reload}>
          <RefreshCw size={12} aria-hidden />
          다시 시도
        </button>
      </div>
    );
  }

  const { policy } = state;
  if (policy.kind === 'managed') {
    const editableRevision = canManage ? policy.revision : undefined;
    return (
      <>
        <table
          aria-label="연결된 파일의 SSH 로그인 허용 규칙"
          className="w-full table-fixed text-left text-sm"
        >
          <thead className="text-gray-400">
            <tr>
              <th scope="col" className="w-1/3 p-2">
                계정
              </th>
              <th scope="col" className="p-2">
                출발지 IP·대역
              </th>
              {editableRevision && (
                <th scope="col" className="w-20 p-2">
                  관리
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800 text-gray-200">
            {policy.rules.map(({ user, source }, index) => (
              <tr key={`${user}@${source}:${index}`}>
                <td className="break-all p-2">{user}</td>
                <td className="break-all p-2 font-mono">{source}</td>
                {editableRevision && (
                  <td className="p-2">
                    {`${user}@${source}` === policy.protectedRule ? (
                      <span className="text-xs text-gray-400">보호</span>
                    ) : (
                      <button
                        type="button"
                        className={smallButton}
                        disabled={saving}
                        aria-label={`${user}@${source} 삭제`}
                        title="규칙 삭제"
                        onClick={() =>
                          showConfirm(
                            `${user}@${source} 허용 규칙을 삭제할까요?`,
                            () =>
                              void save({
                                kind: 'remove',
                                rule: `${user}@${source}`,
                                revision: editableRevision,
                              }),
                            '삭제',
                          )
                        }
                      >
                        <Trash2 size={14} aria-hidden />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {editableRevision && (
          <form
            aria-label="SSH 로그인 허용 규칙 추가"
            className="mt-3 flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!saving && user.trim() && source.trim()) {
                void save({
                  kind: 'add',
                  rule: `${user.trim()}@${source.trim()}`,
                  revision: editableRevision,
                });
              }
            }}
          >
            <label className="grid gap-1 text-xs text-gray-400">
              계정
              <input
                required
                maxLength={64}
                className="rounded border border-gray-700 bg-gray-900 p-2 text-gray-100"
                value={user}
                onChange={(event) => setUser(event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-xs text-gray-400">
              출발지 IP·대역
              <input
                required
                maxLength={64}
                className="rounded border border-gray-700 bg-gray-900 p-2 text-gray-100"
                value={source}
                onChange={(event) => setSource(event.target.value)}
              />
            </label>
            <button
              className={smallButton}
              type="submit"
              disabled={saving || !user.trim() || !source.trim()}
            >
              <Plus size={14} aria-hidden />
              추가
            </button>
          </form>
        )}
        <FormError message={saveError} />
      </>
    );
  }

  const message =
    policy.kind === 'unsupported'
      ? `설정 파일 ${policy.line}번째 줄의 규칙은 이 화면에서 표시할 수 없습니다.`
      : policy.kind === 'unconfigured'
        ? '서버 설정 파일이 연결되지 않았습니다.'
        : '연결된 설정 파일에 허용 규칙이 없습니다.';
  return <p className="text-sm text-gray-400">{message}</p>;
}
