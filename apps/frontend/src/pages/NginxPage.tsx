import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Globe,
  Plus,
  Trash2,
  Edit2,
  Power,
  RefreshCw,
  CheckCircle,
  XCircle,
  Shield,
  Zap,
  Terminal,
  Server,
  Lock,
  AlertTriangle,
  Wifi,
  Copy,
  Search,
} from 'lucide-react';
import { api } from '../lib/api';
import { useModalStore } from '../stores/modal.store';

interface NginxSite {
  name: string;
  domain: string;
  upstream: string;
  ssl: boolean;
  sslCert: string;
  sslKey: string;
  websocket: boolean;
  enabled: boolean;
}

interface UpstreamOption {
  name: string;
  image: string;
  status: string;
  upstreams: Array<{ label: string; value: string }>;
}

interface CertInfo {
  domain: string;
  exists: boolean;
  issuer?: string;
  validFrom?: string;
  validTo?: string;
  daysLeft?: number;
}

interface DnsRecord {
  type: 'A' | 'CNAME' | 'TXT';
  host: string;
  value: string;
  status: 'ok' | 'missing' | 'mismatch';
  actual?: string;
}

interface DnsCheckResult {
  domain: string;
  publicIp: string;
  records: DnsRecord[];
  allOk: boolean;
}

type TabType = 'proxy' | 'ssl' | 'dns';

const emptyForm: Omit<NginxSite, 'enabled'> = {
  name: '',
  domain: '',
  upstream: '',
  ssl: true,
  sslCert: '',
  sslKey: '',
  websocket: false,
};

export function NginxPage() {
  const [tab, setTab] = useState<TabType>('proxy');
  const [sites, setSites] = useState<NginxSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [testOutput, setTestOutput] = useState<{
    success: boolean;
    output: string;
  } | null>(null);
  const [reloading, setReloading] = useState(false);
  const [upstreamOptions, setUpstreamOptions] = useState<UpstreamOption[]>([]);

  // SSL tab state
  const [certs, setCerts] = useState<CertInfo[]>([]);
  const [certsLoading, setCertsLoading] = useState(false);
  const [showCertModal, setShowCertModal] = useState(false);
  const [certForm, setCertForm] = useState({
    domain: '',
    email: 'admin@kscold.com',
    mode: 'webroot',
  });
  const [issuing, setIssuing] = useState(false);

  // DNS tab state
  const [dnsResults, setDnsResults] = useState<DnsCheckResult[]>([]);
  const [dnsLoading, setDnsLoading] = useState(false);
  const [publicIp, setPublicIp] = useState<string>('');
  const [singleDnsCheck, setSingleDnsCheck] = useState('');
  const [singleDnsResult, setSingleDnsResult] = useState<DnsCheckResult | null>(
    null,
  );
  const [singleDnsLoading, setSingleDnsLoading] = useState(false);

  const { showAlert, showConfirm } = useModalStore();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    loadSites();
  }, []);

  useEffect(() => {
    if (tab === 'ssl') loadCerts();
    if (tab === 'dns') loadDnsAll();
  }, [tab]);

  // Auto-open create modal when navigated from container card
  useEffect(() => {
    const upstream = searchParams.get('upstream');
    const name = searchParams.get('name');
    if (upstream && name) {
      setTab('proxy');
      setEditingName(null);
      setForm({
        ...emptyForm,
        name,
        upstream,
        domain: `${name.replace('ubuntu-', '')}.kscold.com`,
      });
      loadUpstreams();
      setShowModal(true);
      setSearchParams({});
    }
  }, [searchParams]);

  // ===== Proxy functions =====
  const loadSites = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/nginx/sites');
      setSites(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadUpstreams = async () => {
    try {
      const { data } = await api.get('/nginx/upstreams');
      setUpstreamOptions(data);
    } catch (e) {
      console.error(e);
    }
  };

  const openCreate = () => {
    setEditingName(null);
    setForm(emptyForm);
    loadUpstreams();
    setShowModal(true);
  };

  const openEdit = (site: NginxSite) => {
    setEditingName(site.name);
    setForm({
      name: site.name,
      domain: site.domain,
      upstream: site.upstream,
      ssl: site.ssl,
      sslCert: site.sslCert,
      sslKey: site.sslKey,
      websocket: site.websocket,
    });
    loadUpstreams();
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.domain || !form.upstream) {
      showAlert('이름, 도메인, Upstream을 모두 입력하세요.');
      return;
    }
    try {
      if (editingName) {
        const { data } = await api.put(`/nginx/sites/${editingName}`, form);
        if (data.testResult?.success) {
          showAlert('저장 및 Nginx 리로드 완료');
        } else if (data.testResult) {
          showAlert(`저장됨 (리로드 실패: ${data.testResult.output})`);
        }
      } else {
        const { data } = await api.post('/nginx/sites', form);
        if (data.testResult?.success) {
          showAlert('사이트 추가 및 Nginx 리로드 완료');
        } else if (data.testResult) {
          showAlert(`추가됨 (리로드 실패: ${data.testResult.output})`);
        }
      }
      setShowModal(false);
      await loadSites();
    } catch (e: any) {
      showAlert(e.response?.data?.message || '저장 중 오류가 발생했습니다.');
    }
  };

  const handleDelete = (site: NginxSite) => {
    showConfirm(
      `"${site.domain}" 사이트를 삭제하시겠습니까?`,
      async () => {
        await api.delete(`/nginx/sites/${site.name}`);
        await loadSites();
      },
      '삭제',
    );
  };

  const handleToggle = async (site: NginxSite) => {
    await api.post(`/nginx/sites/${site.name}/toggle`);
    await loadSites();
  };

  const handleTest = async () => {
    const { data } = await api.post('/nginx/test');
    setTestOutput(data);
  };

  const handleReload = async () => {
    setReloading(true);
    try {
      const { data } = await api.post('/nginx/reload');
      if (data.success) {
        showAlert('Nginx가 성공적으로 리로드됐습니다.');
      } else {
        showAlert(`리로드 실패: ${data.output}`);
      }
    } finally {
      setReloading(false);
    }
  };

  // ===== SSL functions =====
  const loadCerts = async () => {
    try {
      setCertsLoading(true);
      const { data } = await api.get('/nginx/certs');
      setCerts(data);
    } catch (e) {
      console.error(e);
    } finally {
      setCertsLoading(false);
    }
  };

  const handleIssueCert = async () => {
    if (!certForm.domain || !certForm.email) {
      showAlert('도메인과 이메일을 입력하세요.');
      return;
    }
    setIssuing(true);
    try {
      const { data } = await api.post('/nginx/certs/issue', certForm);
      if (data.success) {
        showAlert(`SSL 인증서 발급 성공!\n${data.output}`);
        setShowCertModal(false);
        loadCerts();
      } else {
        showAlert(`인증서 발급 실패:\n${data.output}`);
      }
    } catch (e: any) {
      showAlert(
        e.response?.data?.message || '인증서 발급 중 오류가 발생했습니다.',
      );
    } finally {
      setIssuing(false);
    }
  };

  const handleRenewAll = async () => {
    setIssuing(true);
    try {
      const { data } = await api.post('/nginx/certs/renew');
      if (data.success) {
        showAlert('인증서 갱신 완료');
        loadCerts();
      } else {
        showAlert(`갱신 실패: ${data.output}`);
      }
    } catch (e: any) {
      showAlert('갱신 중 오류가 발생했습니다.');
    } finally {
      setIssuing(false);
    }
  };

  // ===== DNS functions =====
  const loadDnsAll = async () => {
    try {
      setDnsLoading(true);
      const [{ data: results }, { data: ipData }] = await Promise.all([
        api.get('/nginx/dns/verify-all'),
        api.get('/nginx/dns/ip'),
      ]);
      setDnsResults(results);
      setPublicIp(ipData.ip);
    } catch (e) {
      console.error(e);
    } finally {
      setDnsLoading(false);
    }
  };

  const handleSingleDnsCheck = async () => {
    if (!singleDnsCheck.trim()) return;
    setSingleDnsLoading(true);
    try {
      const { data } = await api.post('/nginx/dns/verify', {
        domain: singleDnsCheck.trim(),
      });
      setSingleDnsResult(data);
    } catch (e: any) {
      showAlert('DNS 확인 실패: ' + (e.response?.data?.message || e.message));
    } finally {
      setSingleDnsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showAlert('클립보드에 복사되었습니다.');
  };

  const getDnsStatusIcon = (status: string) => {
    switch (status) {
      case 'ok':
        return <CheckCircle size={14} className="text-green-400" />;
      case 'mismatch':
        return <AlertTriangle size={14} className="text-yellow-400" />;
      case 'missing':
        return <XCircle size={14} className="text-red-400" />;
      default:
        return null;
    }
  };

  const getDnsStatusText = (status: string) => {
    switch (status) {
      case 'ok':
        return '정상';
      case 'mismatch':
        return '불일치';
      case 'missing':
        return '미등록';
      default:
        return status;
    }
  };

  const getDnsStatusColor = (status: string) => {
    switch (status) {
      case 'ok':
        return 'text-green-400 bg-green-950';
      case 'mismatch':
        return 'text-yellow-400 bg-yellow-950';
      case 'missing':
        return 'text-red-400 bg-red-950';
      default:
        return 'text-gray-400 bg-gray-800';
    }
  };

  const allUpstreams = upstreamOptions.flatMap((c) =>
    c.upstreams.map((u) => ({ ...u, containerName: c.name })),
  );

  const getDaysLeftColor = (days?: number) => {
    if (days === undefined) return 'text-gray-400';
    if (days <= 7) return 'text-red-400';
    if (days <= 30) return 'text-yellow-400';
    return 'text-green-400';
  };

  return (
    <div className="h-full overflow-auto p-4 sm:p-6 bg-gray-950">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
          <Globe size={22} className="text-green-400" />
          Nginx 관리
        </h2>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleTest}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition"
          >
            <CheckCircle size={15} />
            테스트
          </button>
          <button
            onClick={handleReload}
            disabled={reloading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition disabled:opacity-50"
          >
            <RefreshCw size={15} className={reloading ? 'animate-spin' : ''} />
            리로드
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-900 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab('proxy')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${
            tab === 'proxy'
              ? 'bg-gray-700 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Globe size={14} className="inline mr-1.5" />
          프록시 ({sites.length})
        </button>
        <button
          onClick={() => setTab('ssl')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${
            tab === 'ssl'
              ? 'bg-gray-700 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Lock size={14} className="inline mr-1.5" />
          SSL 인증서 ({certs.length})
        </button>
        <button
          onClick={() => setTab('dns')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${
            tab === 'dns'
              ? 'bg-gray-700 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Wifi size={14} className="inline mr-1.5" />
          DNS 관리
        </button>
      </div>

      {/* Test output */}
      {testOutput && (
        <div
          className={`mb-4 p-3 rounded-lg border text-sm font-mono whitespace-pre-wrap ${
            testOutput.success
              ? 'bg-green-950 border-green-700 text-green-300'
              : 'bg-red-950 border-red-700 text-red-300'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            {testOutput.success ? (
              <CheckCircle size={14} className="text-green-400" />
            ) : (
              <XCircle size={14} className="text-red-400" />
            )}
            <span className="font-bold">
              {testOutput.success ? 'nginx -t 성공' : 'nginx -t 실패'}
            </span>
            <button
              onClick={() => setTestOutput(null)}
              className="ml-auto text-gray-500 hover:text-gray-300"
            >
              ✕
            </button>
          </div>
          {testOutput.output}
        </div>
      )}

      {/* ===== PROXY TAB ===== */}
      {tab === 'proxy' && (
        <>
          <div className="flex justify-end mb-4">
            <button
              onClick={openCreate}
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
                    site.enabled
                      ? 'border-gray-700'
                      : 'border-gray-800 opacity-60'
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
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Terminal size={11} className="text-gray-500" />
                      <span className="text-sm text-gray-400 truncate">
                        {site.upstream}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleToggle(site)}
                      className={`p-1.5 rounded-lg transition ${site.enabled ? 'text-green-400 hover:bg-green-950' : 'text-gray-500 hover:bg-gray-800'}`}
                      title={site.enabled ? '비활성화' : '활성화'}
                    >
                      <Power size={15} />
                    </button>
                    <button
                      onClick={() => openEdit(site)}
                      className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-950 transition"
                      title="수정"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(site)}
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
      )}

      {/* ===== SSL TAB ===== */}
      {tab === 'ssl' && (
        <>
          <div className="flex justify-end gap-2 mb-4">
            <button
              onClick={handleRenewAll}
              disabled={issuing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg transition disabled:opacity-50"
            >
              <RefreshCw size={15} className={issuing ? 'animate-spin' : ''} />
              전체 갱신
            </button>
            <button
              onClick={() => {
                setCertForm({
                  domain: '',
                  email: 'admin@kscold.com',
                  mode: 'webroot',
                });
                setShowCertModal(true);
              }}
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
                    onClick={() => {
                      setCertForm({
                        domain: cert.domain,
                        email: 'admin@kscold.com',
                        mode: 'webroot',
                      });
                      setShowCertModal(true);
                    }}
                    className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition"
                  >
                    {cert.exists ? '재발급' : '발급'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ===== DNS TAB ===== */}
      {tab === 'dns' && (
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
              onClick={loadDnsAll}
              disabled={dnsLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition disabled:opacity-50"
            >
              <RefreshCw
                size={15}
                className={dnsLoading ? 'animate-spin' : ''}
              />
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
                onKeyDown={(e) => e.key === 'Enter' && handleSingleDnsCheck()}
              />
              <button
                onClick={handleSingleDnsCheck}
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
                    {getDnsStatusIcon(rec.status)}
                    <span className="text-blue-400 font-mono w-14">
                      {rec.type}
                    </span>
                    <span className="text-gray-400 font-mono w-24">
                      {rec.host}
                    </span>
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
              등록된 프록시 사이트가 없습니다. 프록시 탭에서 사이트를
              추가하세요.
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
                        {getDnsStatusIcon(rec.status)}
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
                      <p className="font-semibold mb-1">
                        가비아 DNS 설정 안내:
                      </p>
                      <ol className="list-decimal list-inside space-y-0.5 text-blue-400">
                        <li>dns.gabia.com 접속 후 로그인</li>
                        <li>
                          도메인 "{result.domain.split('.').slice(-2).join('.')}
                          " 선택
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
      )}

      {/* ===== Create/Edit Proxy Modal ===== */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white mb-5">
              {editingName ? '사이트 수정' : '새 사이트 추가'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  설정 파일 이름
                </label>
                <input
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
                  placeholder="예: my-app"
                  value={form.name}
                  disabled={!!editingName}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  도메인
                </label>
                <input
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  placeholder="예: app.kscold.com"
                  value={form.domain}
                  onChange={(e) => setForm({ ...form, domain: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Upstream (프록시 대상)
                </label>
                {allUpstreams.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs text-gray-500 mb-1.5">
                      <Server size={11} className="inline mr-1" />
                      실행 중인 컨테이너에서 선택:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {allUpstreams.map((u) => (
                        <button
                          key={u.value}
                          type="button"
                          onClick={() =>
                            setForm({ ...form, upstream: u.value })
                          }
                          className={`px-2.5 py-1 text-xs rounded-lg border transition ${
                            form.upstream === u.value
                              ? 'bg-blue-600 border-blue-500 text-white'
                              : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-blue-500'
                          }`}
                        >
                          {u.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            upstream: 'http://host.docker.internal:',
                          })
                        }
                        className={`px-2.5 py-1 text-xs rounded-lg border transition ${
                          form.upstream.startsWith(
                            'http://host.docker.internal',
                          )
                            ? 'bg-purple-600 border-purple-500 text-white'
                            : 'bg-gray-800 border-gray-700 text-purple-300 hover:border-purple-500'
                        }`}
                      >
                        Mac 호스트
                      </button>
                    </div>
                  </div>
                )}
                <input
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  placeholder="예: http://ubuntu-galjido:8080"
                  value={form.upstream}
                  onChange={(e) =>
                    setForm({ ...form, upstream: e.target.value })
                  }
                />
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.ssl}
                    onChange={(e) =>
                      setForm({ ...form, ssl: e.target.checked })
                    }
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm text-gray-300">SSL (HTTPS)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.websocket}
                    onChange={(e) =>
                      setForm({ ...form, websocket: e.target.checked })
                    }
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm text-gray-300">WebSocket</span>
                </label>
              </div>
              {form.ssl && (
                <div className="space-y-3 border border-gray-800 rounded-lg p-3">
                  <p className="text-xs text-gray-500">
                    SSL 인증서 경로 (비워두면 기본 경로 사용)
                  </p>
                  <input
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                    placeholder={`/etc/nginx/ssl/${form.domain || 'domain'}/fullchain.pem`}
                    value={form.sslCert}
                    onChange={(e) =>
                      setForm({ ...form, sslCert: e.target.value })
                    }
                  />
                  <input
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                    placeholder={`/etc/nginx/ssl/${form.domain || 'domain'}/privkey.pem`}
                    value={form.sslKey}
                    onChange={(e) =>
                      setForm({ ...form, sslKey: e.target.value })
                    }
                  />
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition text-sm"
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition text-sm font-semibold"
              >
                {editingName ? '저장' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== SSL Issue Modal ===== */}
      {showCertModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
              <Lock size={18} className="text-green-400" />
              SSL 인증서 발급
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  도메인
                </label>
                <input
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  placeholder="예: app.kscold.com"
                  value={certForm.domain}
                  onChange={(e) =>
                    setCertForm({ ...certForm, domain: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  이메일 (Let's Encrypt 알림)
                </label>
                <input
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  placeholder="admin@kscold.com"
                  value={certForm.email}
                  onChange={(e) =>
                    setCertForm({ ...certForm, email: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  발급 방식
                </label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={certForm.mode === 'webroot'}
                      onChange={() =>
                        setCertForm({ ...certForm, mode: 'webroot' })
                      }
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-300">Webroot</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={certForm.mode === 'standalone'}
                      onChange={() =>
                        setCertForm({ ...certForm, mode: 'standalone' })
                      }
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-300">Standalone</span>
                  </label>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {certForm.mode === 'webroot'
                    ? 'Nginx가 실행 중일 때 사용 (도메인이 이미 프록시 설정됨)'
                    : 'Nginx 일시 중지 후 발급 (새 도메인)'}
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCertModal(false)}
                disabled={issuing}
                className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition text-sm disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleIssueCert}
                disabled={issuing}
                className="flex-1 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition text-sm font-semibold disabled:opacity-50"
              >
                {issuing ? '발급 중...' : '발급'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
