import {
  Plus,
  RefreshCw,
  Lock,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import type { CertInfo, CertRenewalStatus } from '../model/nginx.types';
import { SslIssueModal } from './SslIssueModal';

const getDaysLeftColor = (days?: number) => {
  if (days === undefined) return 'text-gray-400';
  if (days <= 7) return 'text-red-400';
  if (days <= 30) return 'text-yellow-400';
  return 'text-green-400';
};

const formatRunAt = (iso: string | null) => {
  if (!iso) return '실행 이력 없음';
  try {
    return new Date(iso).toLocaleString('ko-KR');
  } catch {
    return iso;
  }
};

interface CertListProps {
  certs: CertInfo[];
  certsLoading: boolean;
  renewalStatus: CertRenewalStatus | null;
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
  renewalStatus,
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
      {/* 자동 갱신 스케줄 상태 */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <CalendarClock size={16} className="text-blue-400" />
          <span className="text-sm font-semibold text-white">
            SSL 자동 갱신
          </span>
          <span className="text-xs text-gray-400">
            매일 04:10(KST) · 만료 30일 이내 자동 갱신
          </span>
        </div>
        {renewalStatus ? (
          <div className="flex items-center gap-3 text-xs">
            {renewalStatus.success === null ? (
              <span className="text-gray-400">대기 중</span>
            ) : renewalStatus.success ? (
              <span className="flex items-center gap-1 text-green-400">
                <CheckCircle2 size={12} /> 정상
              </span>
            ) : (
              <span className="flex items-center gap-1 text-red-400">
                <XCircle size={12} /> 실패
              </span>
            )}
            <span className="text-gray-400">
              마지막 실행: {formatRunAt(renewalStatus.lastRunAt)}
              {renewalStatus.trigger &&
                ` (${renewalStatus.trigger === 'schedule' ? '자동' : '수동'})`}
            </span>
            <span className="text-gray-500 truncate">
              {renewalStatus.message}
            </span>
          </div>
        ) : (
          <p className="text-xs text-gray-500">상태를 불러오는 중...</p>
        )}
      </div>

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
