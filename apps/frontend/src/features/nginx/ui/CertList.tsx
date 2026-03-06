import {
  Plus,
  RefreshCw,
  Lock,
  AlertTriangle,
} from 'lucide-react';
import type { CertInfo } from '../lib/nginx.types';
import { SslIssueModal } from './SslIssueModal';

const getDaysLeftColor = (days?: number) => {
  if (days === undefined) return 'text-gray-400';
  if (days <= 7) return 'text-red-400';
  if (days <= 30) return 'text-yellow-400';
  return 'text-green-400';
};

interface CertListProps {
  certs: CertInfo[];
  certsLoading: boolean;
  issuing: boolean;
  showCertModal: boolean;
  certForm: { domain: string; email: string; mode: string };
  setCertForm: (form: { domain: string; email: string; mode: string }) => void;
  setShowCertModal: (show: boolean) => void;
  onRenewAll: () => void;
  onOpenCertModal: (domain?: string) => void;
  onIssueCert: () => void;
}

export function CertList({
  certs,
  certsLoading,
  issuing,
  showCertModal,
  certForm,
  setCertForm,
  setShowCertModal,
  onRenewAll,
  onOpenCertModal,
  onIssueCert,
}: CertListProps) {
  return (
    <>
      <div className="flex justify-end gap-2 mb-4">
        <button
          onClick={onRenewAll}
          disabled={issuing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg transition disabled:opacity-50"
        >
          <RefreshCw size={15} className={issuing ? 'animate-spin' : ''} />
          전체 갱신
        </button>
        <button
          onClick={() => onOpenCertModal()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 hover:bg-green-500 text-white rounded-lg transition"
        >
          <Plus size={15} />
          인증서 발급
        </button>
      </div>

      {certsLoading ? (
        <div className="text-gray-500 text-center py-12">로딩 중...</div>
      ) : certs.length === 0 ? (
        <div className="text-gray-500 text-center py-12">
          등록된 인증서가 없습니다.
        </div>
      ) : (
        <div className="grid gap-3">
          {certs.map((cert) => (
            <div
              key={cert.domain}
              className="bg-gray-900 border border-gray-700 rounded-xl p-4 flex items-center gap-4"
            >
              <Lock
                size={18}
                className={cert.exists ? 'text-green-400' : 'text-gray-600'}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-semibold">
                    {cert.domain}
                  </span>
                  {cert.daysLeft !== undefined && cert.daysLeft <= 30 && (
                    <span className="flex items-center gap-1 text-xs text-yellow-400 bg-yellow-950 px-1.5 py-0.5 rounded">
                      <AlertTriangle size={10} /> 만료 임박
                    </span>
                  )}
                </div>
                {cert.exists ? (
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    {cert.validTo && <span>만료: {cert.validTo}</span>}
                    {cert.daysLeft !== undefined && (
                      <span className={getDaysLeftColor(cert.daysLeft)}>
                        (D-{cert.daysLeft})
                      </span>
                    )}
                    {cert.issuer && (
                      <span className="truncate">발급: {cert.issuer}</span>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 mt-1">인증서 없음</p>
                )}
              </div>
              <button
                onClick={() => onOpenCertModal(cert.domain)}
                className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition"
              >
                {cert.exists ? '재발급' : '발급'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* SSL Issue Modal */}
      {showCertModal && (
        <SslIssueModal
          certForm={certForm}
          setCertForm={setCertForm}
          issuing={issuing}
          onClose={() => setShowCertModal(false)}
          onSubmit={onIssueCert}
        />
      )}
    </>
  );
}
