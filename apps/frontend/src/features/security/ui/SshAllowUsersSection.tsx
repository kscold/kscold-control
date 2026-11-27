import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { securityService } from '../api/security.service';
import { smallButton } from '../lib/paging';
import type { SshAllowUsersPolicy } from '../model/security.types';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; policy: SshAllowUsersPolicy };

export function SshAllowUsersSection() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [revision, setRevision] = useState(0);

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
        <button
          type="button"
          className={smallButton}
          onClick={() => {
            setState({ kind: 'loading' });
            setRevision((value) => value + 1);
          }}
        >
          <RefreshCw size={12} aria-hidden />
          다시 시도
        </button>
      </div>
    );
  }

  const { policy } = state;
  if (policy.kind === 'managed') {
    return (
      <table
        aria-label="SSH 로그인 허용 규칙"
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
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800 text-gray-200">
          {policy.rules.map(({ user, source }, index) => (
            <tr key={`${user}@${source}:${index}`}>
              <td className="break-all p-2">{user}</td>
              <td className="break-all p-2 font-mono">{source}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
