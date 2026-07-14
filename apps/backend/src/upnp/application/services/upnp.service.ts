import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  type IUpnpGatewayRepository,
  UPNP_GATEWAY_REPOSITORY,
} from '../../domain/repositories/upnp-gateway.repository';
import type {
  PortMapping,
  CreateMappingDto,
} from '../../domain/types/port-mapping.type';

@Injectable()
export class UpnpService {
  private readonly logger = new Logger(UpnpService.name);

  constructor(
    @Inject(UPNP_GATEWAY_REPOSITORY)
    private readonly gateway: IUpnpGatewayRepository,
  ) {}

  async getMappings(): Promise<PortMapping[]> {
    try {
      return await this.gateway.getMappings();
    } catch (err) {
      this.logger.warn(
        'getMappings failed, returning empty',
        err instanceof Error ? err.message : err,
      );
      return [];
    }
  }

  async addMapping(dto: CreateMappingDto): Promise<{ success: boolean }> {
    try {
      await this.gateway.addMapping(dto);
      this.logger.log(
        `Port mapping added: ${dto.publicPort} -> ${dto.privatePort} (${dto.protocol || 'TCP'})`,
      );
      return { success: true };
    } catch (err) {
      this.logger.error('Failed to add UPnP mapping', err);
      throw new Error(
        `포트 매핑 추가 실패: ${err instanceof Error ? err.message : err}`,
        { cause: err },
      );
    }
  }

  async removeMapping(
    publicPort: number,
    protocol?: string,
  ): Promise<{ success: boolean }> {
    try {
      const proto = (protocol || 'TCP').toUpperCase();
      await this.gateway.removeMapping(publicPort, proto);
      this.logger.log(`Port mapping removed: ${publicPort} (${proto})`);
      return { success: true };
    } catch (err) {
      this.logger.error('Failed to remove UPnP mapping', err);
      throw new Error(
        `포트 매핑 삭제 실패: ${err instanceof Error ? err.message : err}`,
        { cause: err },
      );
    }
  }

  async getExternalIp(): Promise<string> {
    try {
      return await this.gateway.getExternalIp();
    } catch (err) {
      this.logger.error('Failed to get external IP via UPnP', err);
      throw new Error(
        `외부 IP 조회 실패: ${err instanceof Error ? err.message : err}`,
        { cause: err },
      );
    }
  }
}
