import {
  RefreshCw,
  CheckCircle,
  XCircle,
  Server,
  AlertTriangle,
  Copy,
  Search,
} from 'lucide-react';
import type { DnsCheckResult } from '../model/nginx.types';
import {
  getDnsStatusIcon,
  getDnsStatusIconColor,
  getDnsStatusText,
  getDnsStatusColor,
} from '../lib/dns-status.utils';

interface DnsCheckerProps {
  dnsResults: DnsCheckResult[];
  dnsLoading: boolean;
  publicIp: string;
  singleDnsCheck: string;
  setSingleDnsCheck: (value: string) => void;
  singleDnsResult: DnsCheckResult | null;
  singleDnsLoading: boolean;
  onLoadDnsAll: () => void;
  onSingleDnsCheck: () => void;
  copyToClipboard: (text: string) => void;
}

function DnsStatusIcon({ status, size }: { status: string; size: number }) {
  const IconComponent = getDnsStatusIcon(status);
  if (!IconComponent) return null;
  return (
    <IconComponent size={size} className={getDnsStatusIconColor(status)} />
  );
}

export function DnsChecker({
  dnsResults,
  dnsLoading,
  publicIp,
  singleDnsCheck,
  setSingleDnsCheck,
  singleDnsResult,
  singleDnsLoading,
  onLoadDnsAll,
  onSingleDnsCheck,
  copyToClipboard,
}: DnsCheckerProps) {
  return (
    <>
      {/* Public IP + Refresh */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
        <div className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 flex items-center gap-3">
          <Server size={16} className="text-blue-400" />
          <div>
            <p className="text-xs text-gray-500">서버 공인 IP</p>
            <div className="flex items-center gap-2">
              <span className="text-white font-mono font-semibold">
                {publicIp || '...'}
              </span>
              {publicIp && (
                <button
                  onClick={() => copyToClipboard(publicIp)}
                  className="text-gray-500 hover:text-white transition"
                  title="복사"
                >
                  <Copy size={13} />
                </button>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={onLoadDnsAll}
          disabled={dnsLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition disabled:opacity-50"
        >
          <RefreshCw size={15} className={dnsLoading ? 'animate-spin' : ''} />
          전체 검증
        </button>
      </div>

      {/* Single domain check */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-4">
        <p className="text-sm text-gray-400 mb-2">개별 도메인 DNS 확인</p>
        <div className="flex gap-2">
          <input
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            placeholder="예: galjido.kscold.com"
            value={singleDnsCheck}
            onChange={(e) => setSingleDnsCheck(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSingleDnsCheck()}
          />
          <button
            onClick={onSingleDnsCheck}
            disabled={singleDnsLoading}
            className="flex items-center gap-1.5 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition text-sm disabled:opacity-50"
          >
            <Search size={14} />
            확인
          </button>
        </div>
        {singleDnsResult && (
          <div className="mt-3 border border-gray-800 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              {singleDnsResult.allOk ? (
                <CheckCircle size={16} className="text-green-400" />
              ) : (
                <XCircle size={16} className="text-red-400" />
              )}
              <span className="text-white font-semibold">
                {singleDnsResult.domain}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded ${singleDnsResult.allOk ? 'bg-green-950 text-green-400' : 'bg-red-950 text-red-400'}`}
              >
                {singleDnsResult.allOk ? '정상' : '설정 필요'}
              </span>
            </div>
            {singleDnsResult.records.map((rec, i) => (
              <div
                key={i}
                className="flex items-center gap-3 text-sm py-1.5 border-t border-gray-800"
              >
                <DnsStatusIcon status={rec.status} size={14} />
                <span className="text-blue-400 font-mono w-14">{rec.type}</span>
                <span className="text-gray-400 font-mono w-24">{rec.host}</span>
                <span className="text-gray-300 font-mono flex-1">
                  {rec.value}
                </span>
                {rec.actual && rec.status !== 'ok' && (
                  <span className="text-xs text-yellow-400">
                    현재: {rec.actual}
                  </span>
                )}
                <span
                  className={`text-xs px-1.5 py-0.5 rounded ${getDnsStatusColor(rec.status)}`}
                >
                  {getDnsStatusText(rec.status)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* All sites DNS status */}
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-gray-300">
          프록시 사이트 DNS 상태
        </h3>
        <span className="text-xs text-gray-500">
          가비아 DNS에 아래 레코드를 등록하세요
        </span>
      </div>

      {dnsLoading ? (
        <div className="text-gray-500 text-center py-12">검증 중...</div>
      ) : dnsResults.length === 0 ? (
        <div className="text-gray-500 text-center py-12">
          등록된 프록시 사이트가 없습니다. 프록시 탭에서 사이트를 추가하세요.
        </div>
      ) : (
        <div className="grid gap-3">
          {dnsResults.map((result) => (
            <div
              key={result.domain}
              className="bg-gray-900 border border-gray-700 rounded-xl p-4"
            >
              <div className="flex items-center gap-2 mb-3">
                {result.allOk ? (
                  <CheckCircle size={16} className="text-green-400" />
                ) : (
                  <AlertTriangle size={16} className="text-yellow-400" />
                )}
                <span className="text-white font-semibold">
                  {result.domain}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${result.allOk ? 'bg-green-950 text-green-400' : 'bg-yellow-950 text-yellow-400'}`}
                >
                  {result.allOk ? 'DNS 정상' : 'DNS 설정 필요'}
                </span>
              </div>

              {/* Records table */}
              <div className="bg-gray-950 rounded-lg overflow-hidden">
                <div className="grid grid-cols-[auto_60px_100px_1fr_auto_auto] gap-2 px-3 py-1.5 text-xs text-gray-500 border-b border-gray-800">
                  <span></span>
                  <span>타입</span>
                  <span>호스트</span>
                  <span>값 (서버 IP)</span>
                  <span>현재값</span>
                  <span>상태</span>
                </div>
                {result.records.map((rec, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[auto_60px_100px_1fr_auto_auto] gap-2 items-center px-3 py-2 text-sm border-b border-gray-800/50 last:border-0"
                  >
                    <DnsStatusIcon status={rec.status} size={14} />
                    <span className="text-blue-400 font-mono text-xs">
                      {rec.type}
                    </span>
                    <span className="text-gray-400 font-mono text-xs">
                      {rec.host}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-white font-mono text-xs">
                        {rec.value}
                      </span>
                      <button
                        onClick={() => copyToClipboard(rec.value)}
                        className="text-gray-600 hover:text-white transition"
                        title="복사"
                      >
                        <Copy size={11} />
                      </button>
                    </div>
                    <span className="text-xs text-gray-500 font-mono">
                      {rec.actual || '-'}
                    </span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded ${getDnsStatusColor(rec.status)}`}
                    >
                      {getDnsStatusText(rec.status)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Gabia guide for missing/mismatch records */}
              {!result.allOk && (
                <div className="mt-3 bg-blue-950/30 border border-blue-900/50 rounded-lg p-3 text-xs text-blue-300">
                  <p className="font-semibold mb-1">가비아 DNS 설정 안내:</p>
                  <ol className="list-decimal list-inside space-y-0.5 text-blue-400">
                    <li>dns.gabia.com 접속 후 로그인</li>
                    <li>
                      도메인 "{result.domain.split('.').slice(-2).join('.')}"
                      선택
                    </li>
                    {result.records
                      .filter((r) => r.status !== 'ok')
                      .map((rec, i) => (
                        <li key={i}>
                          {rec.type} 레코드 추가: 호스트{' '}
                          <span className="font-mono bg-blue-900/50 px-1 rounded">
                            {rec.host}
                          </span>{' '}
                          → 값{' '}
                          <span className="font-mono bg-blue-900/50 px-1 rounded">
                            {rec.value}
                          </span>
                        </li>
                      ))}
                    <li>저장 후 전파까지 최대 48시간 (보통 몇 분)</li>
                  </ol>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
