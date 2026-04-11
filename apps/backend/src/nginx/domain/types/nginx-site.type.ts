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

export interface CreateNginxSiteDto {
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
