import {
  Plus,
  Trash2,
  Edit2,
  Power,
  Shield,
  Zap,
  Terminal,
  Lock,
  AlertTriangle,
  Wifi,
} from 'lucide-react';
import type { NginxSite, DnsCheckResult, TabType } from '../lib/nginx.types';

interface SiteListProps {
  sites: NginxSite[];
  loading: boolean;
  proxyDnsStatus: Record<string, DnsCheckResult>;
  proxyDnsLoading: boolean;
  onOpenCreate: () => void;
  onOpenEdit: (site: NginxSite) => void;
  onDelete: (site: NginxSite) => void;
  onToggle: (site: NginxSite) => void;
  onLoadProxyDnsStatus: () => void;
  onOpenCertModal: (domain: string) => void;
  onNavigateDns: (domain: string) => void;
}

export function SiteList({
  sites,
  loading,
  proxyDnsStatus,
  proxyDnsLoading,
  onOpenCreate,
  onOpenEdit,
  onDelete,
  onToggle,
  onLoadProxyDnsStatus,
  onOpenCertModal,
  onNavigateDns,
}: SiteListProps) {
  return (
    <>
      <div className="flex justify-end gap-2 mb-4">
        <button
          onClick={onLoadProxyDnsStatus}
          disabled={proxyDnsLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition disabled:opacity-50"
        >
          <Wifi size={15} className={proxyDnsLoading ? 'animate-pulse' : ''} />
          {proxyDnsLoading ? 'DNS 확인 중...' : 'DNS 상태 확인'}
        </button>
        <button
          onClick={onOpenCreate}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 hover:bg-green-500 text-white rounded-lg transition"
        >
          <Plus size={15} />
          사이트 추가
        </button>
      </div>

      {loading ? (
        <div className="text-gray-500 text-center py-12">로딩 중...</div>
      ) : sites.length === 0 ? (
        <div className="text-gray-500 text-center py-12">
          등록된 사이트가 없습니다.
        </div>
      ) : (
        <div className="grid gap-3">
          {sites.map((site) => (
            <div
              key={site.name}
              className={`bg-gray-900 border rounded-xl p-4 flex items-center gap-4 ${
                site.enabled ? 'border-gray-700' : 'border-gray-800 opacity-60'
              }`}
            >
              <div
                className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${site.enabled ? 'bg-green-400' : 'bg-gray-600'}`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-semibold">
                    {site.domain}
                  </span>
                  {site.ssl && (
                    <span className="flex items-center gap-1 text-xs text-green-400 bg-green-950 px-1.5 py-0.5 rounded">
                      <Shield size={10} /> SSL
                    </span>
                  )}
                  {site.websocket && (
                    <span className="flex items-center gap-1 text-xs text-blue-400 bg-blue-950 px-1.5 py-0.5 rounded">
                      <Zap size={10} /> WS
                    </span>
                  )}
                  {!site.enabled && (
                    <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
                      비활성
                    </span>
                  )}
                  {proxyDnsStatus[site.domain] &&
                    (proxyDnsStatus[site.domain].allOk ? (
                      <span
                        className="flex items-center gap-1 text-xs text-green-400 bg-green-950 px-1.5 py-0.5 rounded"
                        title="DNS 전파 완료"
                      >
                        <Wifi size={10} /> DNS
                      </span>
                    ) : (
                      <span
                        className="flex items-center gap-1 text-xs text-yellow-400 bg-yellow-950 px-1.5 py-0.5 rounded cursor-pointer hover:bg-yellow-900"
                        title="DNS 미전파 — 클릭하여 DNS 탭에서 상세 확인"
                        onClick={() => onNavigateDns(site.domain)}
                      >
                        <AlertTriangle size={10} /> DNS 미전파
                      </span>
                    ))}
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <Terminal size={11} className="text-gray-500" />
                  <span className="text-sm text-gray-400 truncate">
                    {site.upstream}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {proxyDnsStatus[site.domain]?.allOk && site.ssl && (
                  <button
                    onClick={() => onOpenCertModal(site.domain)}
                    className="p-1.5 rounded-lg text-green-400 hover:bg-green-950 transition"
                    title="SSL 인증서 발급"
                  >
                    <Lock size={15} />
                  </button>
                )}
                <button
                  onClick={() => onToggle(site)}
                  className={`p-1.5 rounded-lg transition ${site.enabled ? 'text-green-400 hover:bg-green-950' : 'text-gray-500 hover:bg-gray-800'}`}
                  title={site.enabled ? '비활성화' : '활성화'}
                >
                  <Power size={15} />
                </button>
                <button
                  onClick={() => onOpenEdit(site)}
                  className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-950 transition"
                  title="수정"
                >
                  <Edit2 size={15} />
                </button>
                <button
                  onClick={() => onDelete(site)}
                  className="p-1.5 rounded-lg text-red-400 hover:bg-red-950 transition"
                  title="삭제"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
