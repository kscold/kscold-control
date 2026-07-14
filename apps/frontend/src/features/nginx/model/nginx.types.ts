export interface NginxSite {
  name: string;
  domain: string;
  upstream: string;
  ssl: boolean;
  sslCert: string;
  sslKey: string;
  websocket: boolean;
  enabled: boolean;
}

export interface UpstreamOption {
  name: string;
  image: string;
  status: string;
  upstreams: Array<{ label: string; value: string }>;
}

export interface CertInfo {
  domain: string;
  exists: boolean;
  issuer?: string;
  validFrom?: string;
  validTo?: string;
  daysLeft?: number;
}

/** SSL 인증서 자동 갱신 스케줄 마지막 실행 상태 */
export interface CertRenewalStatus {
  lastRunAt: string | null;
  trigger: 'schedule' | 'manual' | null;
  success: boolean | null;
  renewedDomains: string[];
  message: string;
  certs: Array<{ domain: string; daysLeft: number | null }>;
}

export interface DnsRecord {
  type: 'A' | 'CNAME' | 'TXT';
  host: string;
  value: string;
  status: 'ok' | 'missing' | 'mismatch';
  actual?: string;
}

export interface DnsCheckResult {
  domain: string;
  publicIp: string;
  records: DnsRecord[];
  allOk: boolean;
}

export type TabType = 'proxy' | 'ssl' | 'dns';

export type CreateNginxSiteDto = Omit<NginxSite, 'enabled'>;

export const emptyForm: CreateNginxSiteDto = {
  name: '',
  domain: '',
  upstream: '',
  ssl: true,
  sslCert: '',
  sslKey: '',
  websocket: false,
};
