export interface NginxSite {
  name: string;
  domain: string;
  upstream: string;
  ssl: boolean;
  sslCert: string;
  sslKey: string;
  websocket: boolean;
  enabled: boolean;
  source?: 'config' | 'inferred';
  raw?: string;
}

/** Nginx 설정 파일을 생성·갱신하는 도메인 구성값임. */
export interface NginxSiteConfiguration {
  name: string;
  domain: string;
  upstream: string;
  ssl: boolean;
  sslCert?: string;
  sslKey?: string;
  websocket: boolean;
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
