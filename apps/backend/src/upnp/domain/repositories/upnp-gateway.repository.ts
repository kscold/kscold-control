import type { PortMapping, PortMappingDraft } from '../types/port-mapping.type';

export interface IUpnpGatewayRepository {
  getMappings(): Promise<PortMapping[]>;
  addMapping(draft: PortMappingDraft): Promise<void>;
  removeMapping(publicPort: number, protocol: string): Promise<void>;
  getExternalIp(): Promise<string>;
}

export const UPNP_GATEWAY_REPOSITORY = Symbol('UPNP_GATEWAY_REPOSITORY');
