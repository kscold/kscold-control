import { Trash2, Clock, Ban, Zap } from 'lucide-react';
import type { IpBan } from '../model/security.types';

interface Props {
  bans: IpBan[];
  onRemove: (id: string) => Promise<void>;
}

function formatDate(iso: string | null): string {
  if (!iso) return '영구';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function sourceBadge(source: IpBan['source']) {
  switch (source) {
    case 'manual':
      return {
        label: '수동',
        class: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
      };
    case 'auto-nginx':
      return {
        label: '자동(nginx)',
        class: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
      };
    case 'auto-ssh':
      return {
        label: '자동(SSH)',
        class: 'bg-violet-500/10 text-violet-300 border-violet-500/30',
      };
  }
}

export function BanList({ bans, onRemove }: Props) {
  if (bans.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-800 bg-gray-900/30 p-8 text-center">
        <Ban size={32} className="mx-auto text-gray-700" />
        <p className="mt-3 text-sm text-gray-500">차단된 IP가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {bans.map((ban) => {
        const badge = sourceBadge(ban.source);
        return (
          <div
            key={ban.id}
            className={`rounded-xl border bg-gray-900/60 p-3 transition ${
              ban.active ? 'border-gray-800' : 'border-gray-900 opacity-50'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-white">
                    {ban.ip}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${badge.class}`}
                  >
                    {badge.label}
                  </span>
                  {!ban.active && (
                    <span className="rounded-full border border-gray-700 bg-gray-800 px-2 py-0.5 text-[10px] text-gray-400">
                      해제됨
                    </span>
                  )}
                </div>
                {ban.reason && (
                  <p className="mt-1 text-sm text-gray-400">{ban.reason}</p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1">
                    <Zap size={11} /> 추가: {formatDate(ban.createdAt)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock size={11} /> 만료: {formatDate(ban.expiresAt)}
                  </span>
                </div>
              </div>

              {ban.active && (
                <button
                  onClick={() => {
                    if (confirm(`${ban.ip} 차단을 해제할까요?`)) {
                      void onRemove(ban.id);
                    }
                  }}
                  className="shrink-0 rounded-lg p-2 text-gray-500 hover:bg-red-950/50 hover:text-red-400"
                  aria-label="차단 해제"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
