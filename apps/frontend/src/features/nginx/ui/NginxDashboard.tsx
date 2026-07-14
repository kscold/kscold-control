import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Globe,
  CheckCircle,
  XCircle,
  RefreshCw,
  Lock,
  Wifi,
} from 'lucide-react';
import type { TabType } from '../model/nginx.types';
import { emptyForm } from '../model/nginx.types';
import { useNginxSites } from '../model/useNginxSites';
import { useNginxConfig } from '../model/useNginxConfig';
import { useNginxCerts } from '../model/useNginxCerts';
import { useNginxDns } from '../model/useNginxDns';
import { SiteList } from './SiteList';
import { SiteFormModal } from './SiteFormModal';
import { CertList } from './CertList';
import { DnsChecker } from './DnsChecker';
import { SslIssueModal } from './SslIssueModal';

export function NginxDashboard() {
  const [tab, setTab] = useState<TabType>('proxy');
  const [searchParams, setSearchParams] = useSearchParams();

  const sitesHook = useNginxSites();
  const configHook = useNginxConfig();
  const certsHook = useNginxCerts();
  const dnsHook = useNginxDns();

  useEffect(() => {
    sitesHook.loadSites();
    certsHook.loadCerts();
  }, []);

  useEffect(() => {
    if (tab === 'ssl') certsHook.loadCerts();
    if (tab === 'dns') dnsHook.loadDnsAll();
  }, [tab]);

  // Auto-open create modal when navigated from container card
  useEffect(() => {
    const upstream = searchParams.get('upstream');
    const name = searchParams.get('name');
    if (upstream && name) {
      setTab('proxy');
      sitesHook.setEditingName(null);
      sitesHook.setForm({
        ...emptyForm,
        name,
        upstream,
        domain: `${name.replace('ubuntu-', '')}.kscold.com`,
      });
      sitesHook.loadUpstreams();
      sitesHook.setShowModal(true);
      setSearchParams({});
    }
  }, [searchParams]);

  const handleNavigateDns = (domain: string) => {
    setTab('dns');
    dnsHook.setSingleDnsCheck(domain);
    dnsHook.loadDnsAll();
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
            onClick={configHook.handleTest}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition"
          >
            <CheckCircle size={15} />
            테스트
          </button>
          <button
            onClick={configHook.handleReload}
            disabled={configHook.reloading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition disabled:opacity-50"
          >
            <RefreshCw
              size={15}
              className={configHook.reloading ? 'animate-spin' : ''}
            />
            리로드
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:overflow-visible sm:px-0">
        <div className="inline-flex gap-1 bg-gray-900 p-1 rounded-lg">
          <button
            onClick={() => setTab('proxy')}
            className={`whitespace-nowrap px-3 sm:px-4 py-2 rounded-md text-sm font-medium transition ${
              tab === 'proxy'
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Globe size={14} className="inline mr-1.5" />
            프록시 ({sitesHook.sites.length})
          </button>
          <button
            onClick={() => setTab('ssl')}
            className={`whitespace-nowrap px-3 sm:px-4 py-2 rounded-md text-sm font-medium transition ${
              tab === 'ssl'
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Lock size={14} className="inline mr-1.5" />
            SSL 인증서 ({certsHook.certs.length})
          </button>
          <button
            onClick={() => setTab('dns')}
            className={`whitespace-nowrap px-3 sm:px-4 py-2 rounded-md text-sm font-medium transition ${
              tab === 'dns'
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Wifi size={14} className="inline mr-1.5" />
            DNS 관리
          </button>
        </div>
      </div>

      {/* Test output */}
      {configHook.testOutput && (
        <div
          className={`mb-4 p-3 rounded-lg border text-sm font-mono whitespace-pre-wrap ${
            configHook.testOutput.success
              ? 'bg-green-950 border-green-700 text-green-300'
              : 'bg-red-950 border-red-700 text-red-300'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            {configHook.testOutput.success ? (
              <CheckCircle size={14} className="text-green-400" />
            ) : (
              <XCircle size={14} className="text-red-400" />
            )}
            <span className="font-bold">
              {configHook.testOutput.success
                ? 'nginx -t 성공'
                : 'nginx -t 실패'}
            </span>
            <button
              onClick={() => configHook.setTestOutput(null)}
              className="ml-auto text-gray-500 hover:text-gray-300"
            >
              ✕
            </button>
          </div>
          {configHook.testOutput.output}
        </div>
      )}

      {/* ===== PROXY TAB ===== */}
      {tab === 'proxy' && (
        <SiteList
          sites={sitesHook.sites}
          loading={sitesHook.loading}
          proxyDnsStatus={sitesHook.proxyDnsStatus}
          proxyDnsLoading={sitesHook.proxyDnsLoading}
          onOpenCreate={sitesHook.openCreate}
          onOpenEdit={sitesHook.openEdit}
          onDelete={sitesHook.handleDelete}
          onToggle={sitesHook.handleToggle}
          onLoadProxyDnsStatus={sitesHook.loadProxyDnsStatus}
          onOpenCertModal={certsHook.openCertModal}
          onNavigateDns={handleNavigateDns}
        />
      )}

      {/* ===== SSL TAB ===== */}
      {tab === 'ssl' && (
        <CertList
          certs={certsHook.certs}
          certsLoading={certsHook.certsLoading}
          renewalStatus={certsHook.renewalStatus}
          issuing={certsHook.issuing}
          showCertModal={certsHook.showCertModal}
          certForm={certsHook.certForm}
          setCertForm={certsHook.setCertForm}
          setShowCertModal={certsHook.setShowCertModal}
          onRenewAll={certsHook.handleRenewAll}
          onOpenCertModal={certsHook.openCertModal}
          onIssueCert={certsHook.handleIssueCert}
        />
      )}

      {/* ===== DNS TAB ===== */}
      {tab === 'dns' && (
        <DnsChecker
          dnsResults={dnsHook.dnsResults}
          dnsLoading={dnsHook.dnsLoading}
          publicIp={dnsHook.publicIp}
          singleDnsCheck={dnsHook.singleDnsCheck}
          setSingleDnsCheck={dnsHook.setSingleDnsCheck}
          singleDnsResult={dnsHook.singleDnsResult}
          singleDnsLoading={dnsHook.singleDnsLoading}
          onLoadDnsAll={dnsHook.loadDnsAll}
          onSingleDnsCheck={dnsHook.handleSingleDnsCheck}
          copyToClipboard={dnsHook.copyToClipboard}
        />
      )}

      {/* ===== Create/Edit Proxy Modal ===== */}
      {sitesHook.showModal && (
        <SiteFormModal
          editingName={sitesHook.editingName}
          form={sitesHook.form}
          setForm={sitesHook.setForm}
          allUpstreams={sitesHook.allUpstreams}
          onSubmit={sitesHook.handleSubmit}
          onClose={() => sitesHook.setShowModal(false)}
        />
      )}

      {/* ===== SSL Issue Modal (from proxy tab cert button) ===== */}
      {tab === 'proxy' && certsHook.showCertModal && (
        <SslIssueModal
          certForm={certsHook.certForm}
          setCertForm={certsHook.setCertForm}
          issuing={certsHook.issuing}
          onClose={() => certsHook.setShowCertModal(false)}
          onSubmit={certsHook.handleIssueCert}
        />
      )}
    </div>
  );
}
