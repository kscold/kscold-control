import { useEffect, useMemo, useState } from 'react';
import type { SshBlock, SshBlockScope } from '../model/security.types';
import { smallButton, usePaged } from '../model/paging';
import { Pager } from './Pager';

const BLOCK_SCOPE_LABEL: Record<
  SshBlockScope,
  { label: string; className: string }
> = {
  all: {
    label: 'SSH·사이트',
    className: 'border-red-500/30 bg-red-500/10 text-red-300',
  },
  ssh: {
    label: 'SSH 만',
    className: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  },
};

/**
 * 맥미니 방화벽(ssh-guard) 차단 목록 — SSH 접속 탭과 웹 IP 차단 탭이 같이 씀
 * 찾기·쪽 나누기·범위 바꾸기·해제를 한곳에서 처리함
 */
export function FirewallBlockList({
  blocks,
  canManage,
  disabled,
  confirm,
  onScope,
  onUnblock,
  emptyText = '막고 있는 IP 가 없습니다',
}: {
  blocks: SshBlock[];
  canManage: boolean;
  disabled: boolean;
  /** 확인을 받은 뒤 실행 */
  confirm: (message: string, key: string, fn: () => Promise<unknown>) => void;
  onScope: (ip: string, scope: SshBlockScope) => Promise<unknown>;
  onUnblock: (ip: string) => Promise<unknown>;
  emptyText?: string;
}) {
  const [query, setQuery] = useState('');
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? blocks.filter((b) =>
          `${b.ip} ${b.reason ?? ''}`.toLowerCase().includes(q),
        )
      : blocks;
  }, [blocks, query]);
  const paged = usePaged(list, 10);
  const { setPage } = paged;
  useEffect(() => setPage(0), [query, setPage]);

  return (
    <div>
      {blocks.length > 10 && (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="IP·이유 찾기"
          aria-label="차단 목록 찾기"
          className="mb-2 w-full min-w-0 rounded-lg border border-gray-800 bg-gray-900 px-3 py-1.5 text-xs text-white placeholder:text-gray-600 focus:border-gray-600 focus:outline-none sm:w-60"
        />
      )}
      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-800 bg-gray-900/30 p-5 text-center text-sm text-gray-500">
          {query ? '찾는 IP 가 없습니다' : emptyText}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {paged.items.map((b) => (
            <div
              key={`${b.source}:${b.ip}`}
              className="flex items-start gap-3 rounded-xl border border-gray-800 bg-gray-900/60 p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-mono text-sm text-white">
                    {b.ip}
                  </span>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${
                      b.source === 'auto'
                        ? 'border-violet-500/30 bg-violet-500/10 text-violet-300'
                        : 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                    }`}
                  >
                    {b.source === 'auto' ? '자동' : '수동'}
                  </span>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${BLOCK_SCOPE_LABEL[b.scope].className}`}
                  >
                    {BLOCK_SCOPE_LABEL[b.scope].label}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-gray-500">
                  {b.blockedAt ?? '-'}
                  {b.reason ? ` · ${b.reason}` : ''}
                </p>
              </div>
              {canManage && (
                <div className="flex shrink-0 gap-1">
                  <button
                    className={smallButton}
                    disabled={disabled}
                    onClick={() => {
                      const next: SshBlockScope =
                        b.scope === 'all' ? 'ssh' : 'all';
                      confirm(
                        next === 'ssh'
                          ? `${b.ip} 를 SSH 만 막도록 바꿀까요?\n운영 중인 사이트에는 다시 들어올 수 있습니다.`
                          : `${b.ip} 를 사이트까지 막을까요?\nSSH 와 맥미니에서 운영 중인 사이트 접속을 모두 막습니다.`,
                        `scope:${b.ip}`,
                        () => onScope(b.ip, next),
                      );
                    }}
                  >
                    {b.scope === 'all' ? 'SSH 만' : '사이트까지'}
                  </button>
                  <button
                    className={smallButton}
                    disabled={disabled}
                    onClick={() =>
                      confirm(
                        `${b.ip} 의 차단을 풀까요?${
                          b.source === 'auto'
                            ? '\n같은 시도가 다시 오면 또 자동으로 막힙니다. 내 IP 라면 "내 IP" 로 표시하세요.'
                            : ''
                        }`,
                        `unblock:${b.ip}`,
                        () => onUnblock(b.ip),
                      )
                    }
                  >
                    해제
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <Pager {...paged} />
    </div>
  );
}
