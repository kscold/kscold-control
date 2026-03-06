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
