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

export interface CreateMappingForm {
  publicPort: string;
  privatePort: string;
  protocol: 'TCP' | 'UDP';
  description: string;
}

export const emptyForm: CreateMappingForm = {
  publicPort: '',
  privatePort: '',
  protocol: 'TCP',
  description: 'kscold-control',
};
