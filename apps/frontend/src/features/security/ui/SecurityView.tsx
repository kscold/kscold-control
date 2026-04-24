import { useState } from 'react';
import { Shield, Plus, Loader2, RefreshCw } from 'lucide-react';
import { useIpBans } from '../hooks/useIpBans';
import { BanList } from './BanList';
import { AddBanModal } from './AddBanModal';

export function SecurityView() {
  const { bans, loading, error, reload, create, remove, resync } = useIpBans();
  const [addOpen, setAddOpen] = useState(false);
  const [resyncing, setResyncing] = useState(false);
  const [resyncMsg, setResyncMsg] = useState<string | null>(null);

  const active = bans.filter((b) => b.active);
  const inactive = bans.filter((b) => !b.active);

  const handleResync = async () => {
    setResyncing(true);
    setResyncMsg(null);
    try {
      const result = await resync();
      setResyncMsg(
        result.reloaded
          ? `nginx 재동기화 완료 (활성 ${result.count}건)`
          : 'nginx reload 실패 — 로그를 확인하세요',
      );
    } catch (e) {
      setResyncMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setResyncing(false);
      window.setTimeout(() => setResyncMsg(null), 4000);
    }
  };

  return (
    <div className="h-full overflow-auto bg-gray-950 p-4 sm:p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-3 text-xl font-bold text-white sm:text-2xl">
            <Shield size={24} className="shrink-0 text-red-400 sm:h-7 sm:w-7" />
            보안 / IP 차단
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            IP 차단 기록 + 감사 로그. 활성 {active.length}건.
          </p>
          <p className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/90">
            ⚠ 현재는 UI/감사 로그 용도로만 동작합니다. colima의 QEMU 네트워킹이
            외부 트래픽을 VM-level SNAT 처리해 nginx가 실제 client IP 대신{' '}
            <code className="font-mono">172.18.0.1</code>로 보고 있어, 등록된
            IP가 실제로 차단되지 않습니다. Cloudflare proxy 또는 colima bridged
            network 적용 뒤에 실제 차단이 동작합니다.
          </p>
        </div>

        <div className="flex shrink-0 gap-2 self-start sm:self-auto">
          <button
            onClick={handleResync}
            disabled={resyncing}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-gray-300 hover:border-gray-700 hover:text-white disabled:opacity-50"
          >
            <RefreshCw size={14} className={resyncing ? 'animate-spin' : ''} />
            재동기화
          </button>
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            <Plus size={16} />
            차단 추가
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {resyncMsg && (
        <div className="mb-4 rounded-lg border border-blue-900/50 bg-blue-950/30 px-4 py-3 text-sm text-blue-200">
          {resyncMsg}
        </div>
      )}

      {loading && bans.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-gray-600" />
        </div>
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">
              활성 차단 ({active.length})
            </h2>
            <BanList bans={active} onRemove={remove} />
          </section>

          {inactive.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">
                과거 기록 ({inactive.length})
              </h2>
              <BanList bans={inactive} onRemove={remove} />
            </section>
          )}
        </div>
      )}

      <AddBanModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreate={async (input) => {
          await create(input);
          await reload();
        }}
      />
    </div>
  );
}
