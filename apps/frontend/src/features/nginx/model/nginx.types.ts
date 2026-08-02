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

/**
 * Nginx 명령 실행 결과 (설정 테스트·리로드·인증서 발급·갱신 공통 응답)
 * 백엔드 NginxSiteService.testConfig/reloadNginx, CertService.issueCert/issueCertStandalone/renewAll 이 반환한다.
 */
export interface NginxCommandResult {
  success: boolean;
  output: string;
}

/**
 * 사이트 생성·수정 응답
 * 저장된 사이트 정보에 자동 실행된 설정 테스트 결과(testResult)가 함께 담긴다.
 */
export interface NginxSiteMutationResult extends NginxSite {
  testResult: NginxCommandResult;
}

/** 사이트 삭제 응답 — 삭제 성공 여부와 삭제 후 설정 테스트 결과 */
export interface NginxSiteDeleteResult {
  success: boolean;
  testResult: NginxCommandResult;
}

/** 사이트 활성/비활성 토글 응답 — 토글 후 상태와 설정 테스트 결과 */
export interface NginxSiteToggleResult {
  enabled: boolean;
  testResult: NginxCommandResult;
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
