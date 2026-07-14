import { useState } from 'react';
import { useModalStore } from '@/shared/model';
import { nginxService } from '../api/nginx.service';
import type { CertInfo, CertRenewalStatus } from '../model/nginx.types';

export function useNginxCerts() {
  const [certs, setCerts] = useState<CertInfo[]>([]);
  const [certsLoading, setCertsLoading] = useState(false);
  const [renewalStatus, setRenewalStatus] = useState<CertRenewalStatus | null>(
    null,
  );
  const [showCertModal, setShowCertModal] = useState(false);
  const [certForm, setCertForm] = useState({
    domain: '',
    email: 'admin@kscold.com',
    mode: 'webroot',
  });
  const [issuing, setIssuing] = useState(false);

  const { showAlert } = useModalStore();

  const loadCerts = async () => {
    try {
      setCertsLoading(true);
      const [data, status] = await Promise.all([
        nginxService.listCerts(),
        nginxService.getRenewalStatus().catch(() => null),
      ]);
      setCerts(data);
      if (status) setRenewalStatus(status);
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
      const data = await nginxService.issueCert(certForm);
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
      const data = await nginxService.renewAll();
      if (data.success) {
        showAlert('인증서 갱신 완료');
        loadCerts();
      } else {
        showAlert(`갱신 실패: ${data.output}`);
      }
    } catch {
      showAlert('갱신 중 오류가 발생했습니다.');
    } finally {
      setIssuing(false);
    }
  };

  const openCertModal = (domain = '') => {
    setCertForm({
      domain,
      email: 'admin@kscold.com',
      mode: 'webroot',
    });
    setShowCertModal(true);
  };

  return {
    certs,
    certsLoading,
    renewalStatus,
    showCertModal,
    setShowCertModal,
    certForm,
    setCertForm,
    issuing,
    loadCerts,
    handleIssueCert,
    handleRenewAll,
    openCertModal,
  };
}
