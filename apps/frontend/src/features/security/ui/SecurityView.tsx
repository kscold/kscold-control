import { lazy, Suspense, useState } from 'react';
import { Shield, Plus, Loader2, RefreshCw } from 'lucide-react';
import { SshAccessPanel } from './SshAccessPanel';
import { useIpBans } from '../model/useIpBans';
import { useFirewallBlocks } from '../model/useFirewallBlocks';
import { useModalStore } from '@/shared/model/modal.store';
import { usePermissions } from '@/shared/lib';
import { PERMISSIONS } from '@/shared/config/permissions';
import { FirewallBlockList } from './FirewallBlockList';
import { BanList } from './BanList';
import { AddBanModal } from './AddBanModal';

// 세계 지도 자료가 커서 탭을 열 때만 받는다
const AttackMapPanel = lazy(() => import('./AttackMapPanel'));

const TABS = [
  ['ssh', 'SSH 접속'],
  ['map', '공격 지도'],
  ['bans', '사이트 IP 차단'],
] as const;

type SecurityTab = (typeof TABS)[number][0];

const TAB_KEY = 'security-tab';

const isTab = (value: string | null): value is SecurityTab =>
  TABS.some(([key]) => key === value);

function initialTab(): SecurityTab {
  if (typeof window === 'undefined') return 'ssh';
  const fromUrl = new URLSearchParams(window.location.search).get('tab');
  if (isTab(fromUrl)) return fromUrl;
  try {
    const saved = window.localStorage.getItem(TAB_KEY);
    return isTab(saved) ? saved : 'ssh';
  } catch {
    return 'ssh';
  }
}

export function SecurityView() {
  const [tab, setTab] = useState<SecurityTab>(initialTab);
  const selectTab = (next: SecurityTab) => {
    setTab(next);
    try {
      window.localStorage.setItem(TAB_KEY, next);
    } catch {
      // 저장 못 해도 화면은 그대로 동작
    }
  };
  const { bans, loading, error, reload, create, remove, resync } = useIpBans();
  const [addOpen, setAddOpen] = useState(false);
  const firewall = useFirewallBlocks();
  const [firewallWorking, setFirewallWorking] = useState(false);
  const { showConfirm, showAlert } = useModalStore();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission(PERMISSIONS.SECURITY_MANAGE);
  const firewallAll = (firewall.data?.items ?? []).filter(
    (b) => b.scope === 'all',
  );
  const firewallSshOnly =
    (firewall.data?.items.length ?? 0) - firewallAll.length;
  const confirmFirewall = (
    message: string,
    _key: string,
    fn: () => Promise<unknown>,
  ) =>
    showConfirm(
      message,
      () => {
        setFirewallWorking(true);
        void fn()
          .catch((e: unknown) =>
            showAlert(e instanceof Error ? e.message : String(e), '요청 실패'),
          )
          .finally(() => setFirewallWorking(false));
      },
      '확인',
    );
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
            보안
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {tab === 'ssh'
              ? '맥미니 SSH 접속 기록 · 열린 세션 · 공격 IP 차단'
              : tab === 'map'
                ? '공격 IP 가 어느 나라·도시에서 오는지'
                : `사이트 접속 차단 — 방화벽 ${firewallAll.length}건 · nginx ${active.length}건`}
          </p>
        </div>

        {tab === 'bans' && (
          <div className="flex shrink-0 gap-2 self-start sm:self-auto">
            <button
              onClick={handleResync}
              disabled={resyncing}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-gray-300 hover:border-gray-700 hover:text-white disabled:opacity-50"
            >
              <RefreshCw
                size={14}
                className={resyncing ? 'animate-spin' : ''}
              />
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
        )}
      </div>

      <div className="mb-6 flex gap-1 border-b border-gray-800" role="tablist">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => selectTab(key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm ${
              tab === key
                ? 'border-red-500 text-white'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'ssh' ? (
        <SshAccessPanel />
      ) : tab === 'map' ? (
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-gray-600" />
            </div>
          }
        >
          <AttackMapPanel />
        </Suspense>
      ) : (
        <>
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
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    방화벽 차단 · SSH·사이트 ({firewallAll.length})
                  </h2>
                  <button
                    onClick={() => selectTab('ssh')}
                    className="text-xs text-gray-500 underline-offset-2 hover:text-white hover:underline"
                  >
                    SSH 접속 탭에서 자세히
                  </button>
                </div>
                <p className="mb-3 text-xs text-gray-500">
                  SSH 공격으로 자동 차단했거나 SSH 접속 탭에서 막은 IP 입니다.
                  맥미니 방화벽에서 막아 nginx 에 닿기 전에 모든 사이트 접속이
                  끊깁니다. SSH 접속 탭과 같은 목록이라 여기서 바꾸면 그쪽에도
                  바로 반영됩니다.
                  {firewallSshOnly > 0 &&
                    ` SSH 만 막는 IP ${firewallSshOnly}개는 SSH 접속 탭에서 봅니다.`}
                </p>
                {firewall.error && (
                  <p className="mb-2 text-xs text-red-400">{firewall.error}</p>
                )}
                {firewall.data && !firewall.data.guard.running && (
                  <p className="mb-2 text-xs text-amber-300">
                    차단기가 꺼져 있어 이 목록이 방화벽에 반영되지 않고
                    있습니다.
                  </p>
                )}
                <FirewallBlockList
                  blocks={firewallAll}
                  canManage={canManage}
                  disabled={firewallWorking}
                  confirm={confirmFirewall}
                  onScope={firewall.setScope}
                  onUnblock={firewall.unblock}
                  emptyText="방화벽에서 사이트까지 막은 IP 가 없습니다"
                />
              </section>

              <section>
                <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">
                  nginx 차단 ({active.length})
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
        </>
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
