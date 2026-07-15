export interface PortMapping {
  publicPort: number;
  privatePort: number;
  protocol: 'TCP' | 'UDP';
  description: string;
  enabled: boolean;
  ttl: number;
  privateHost: string;
  local: boolean;
}

/** 라우터에 추가할 포트 매핑 도메인 구성값임. */
export interface PortMappingDraft {
  publicPort: number;
  privatePort: number;
  protocol?: 'TCP' | 'UDP';
  description?: string;
}

export interface GatewayInfo {
  host: string;
  port: number;
  controlUrl: string;
  serviceType: string;
}
