import { useState } from 'react';
import { useModalStore } from '../../../shared/model';
import { nginxService } from '../api/nginx.service';
import type {
  NginxSite,
  CreateNginxSiteDto,
  UpstreamOption,
  DnsCheckResult,
} from '../lib/nginx.types';
import { emptyForm } from '../lib/nginx.types';

export function useNginxSites() {
  const [sites, setSites] = useState<NginxSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [form, setForm] = useState<CreateNginxSiteDto>(emptyForm);
  const [upstreamOptions, setUpstreamOptions] = useState<UpstreamOption[]>([]);
  const [proxyDnsStatus, setProxyDnsStatus] = useState<
    Record<string, DnsCheckResult>
  >({});
  const [proxyDnsLoading, setProxyDnsLoading] = useState(false);

  const { showAlert, showConfirm } = useModalStore();

  const loadSites = async () => {
    try {
      setLoading(true);
      const data = await nginxService.listSites();
      setSites(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadUpstreams = async () => {
    try {
      const data = await nginxService.getUpstreams();
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
        const data = await nginxService.updateSite(editingName, form);
        if (data.testResult?.success) {
          showAlert('저장 및 Nginx 리로드 완료');
        } else if (data.testResult) {
          showAlert(`저장됨 (리로드 실패: ${data.testResult.output})`);
        }
      } else {
        const data = await nginxService.createSite(form);
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
        await nginxService.deleteSite(site.name);
        await loadSites();
      },
      '삭제',
    );
  };

  const handleToggle = async (site: NginxSite) => {
    await nginxService.toggleSite(site.name);
    await loadSites();
  };

  const loadProxyDnsStatus = async () => {
    setProxyDnsLoading(true);
    try {
      const data = await nginxService.verifyAllDns();
      const map: Record<string, DnsCheckResult> = {};
      data.forEach((r) => {
        map[r.domain] = r;
      });
      setProxyDnsStatus(map);
    } catch (e) {
      console.error(e);
    } finally {
      setProxyDnsLoading(false);
    }
  };

  const allUpstreams = upstreamOptions.flatMap((c) =>
    c.upstreams.map((u) => ({ ...u, containerName: c.name })),
  );

  return {
    sites,
    loading,
    showModal,
    setShowModal,
    editingName,
    setEditingName,
    form,
    setForm,
    upstreamOptions,
    allUpstreams,
    proxyDnsStatus,
    proxyDnsLoading,
    loadSites,
    loadUpstreams,
    openCreate,
    openEdit,
    handleSubmit,
    handleDelete,
    handleToggle,
    loadProxyDnsStatus,
  };
}
