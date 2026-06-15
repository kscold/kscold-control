import type { PortMapping, CreateMappingDto } from '../types/port-mapping.type';

export interface IUpnpGatewayRepository {
  getMappings(): Promise<PortMapping[]>;
  addMapping(dto: CreateMappingDto): Promise<void>;
  removeMapping(publicPort: number, protocol: string): Promise<void>;
  getExternalIp(): Promise<string>;
}

export const UPNP_GATEWAY_REPOSITORY = Symbol('UPNP_GATEWAY_REPOSITORY');
