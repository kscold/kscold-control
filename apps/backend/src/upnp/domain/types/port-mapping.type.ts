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

export interface CreateMappingDto {
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
