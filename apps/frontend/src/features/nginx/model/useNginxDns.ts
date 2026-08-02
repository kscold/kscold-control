import { useState } from 'react';
import { useModalStore } from '@/shared/model';
import { nginxService } from '../api/nginx.service';
import type { DnsCheckResult } from '../model/nginx.types';

export function useNginxDns() {
  const [dnsResults, setDnsResults] = useState<DnsCheckResult[]>([]);
  const [dnsLoading, setDnsLoading] = useState(false);
  const [publicIp, setPublicIp] = useState<string>('');
  const [singleDnsCheck, setSingleDnsCheck] = useState('');
  const [singleDnsResult, setSingleDnsResult] = useState<DnsCheckResult | null>(
    null,
  );
  const [singleDnsLoading, setSingleDnsLoading] = useState(false);

  const { showAlert } = useModalStore();

  const loadDnsAll = async () => {
    try {
      setDnsLoading(true);
      const [results, ip] = await Promise.all([
        nginxService.verifyAllDns(),
        nginxService.getPublicIp(),
      ]);
      setDnsResults(results);
      setPublicIp(ip);
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
      const data = await nginxService.verifyDns(singleDnsCheck.trim());
      setSingleDnsResult(data);
    } catch (e: any) {
      showAlert(
        'DNS 확인 실패: ' + (e instanceof Error ? e.message : String(e)),
      );
    } finally {
      setSingleDnsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showAlert('클립보드에 복사되었습니다.');
  };

  return {
    dnsResults,
    dnsLoading,
    publicIp,
    singleDnsCheck,
    setSingleDnsCheck,
    singleDnsResult,
    singleDnsLoading,
    loadDnsAll,
    handleSingleDnsCheck,
    copyToClipboard,
  };
}
