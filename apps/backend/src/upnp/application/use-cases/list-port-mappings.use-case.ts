import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  type IUpnpGatewayRepository,
  UPNP_GATEWAY_REPOSITORY,
} from '../../domain/repositories/upnp-gateway.repository';
import type { PortMapping } from '../../domain/types/port-mapping.type';

/** UPnP 포트 매핑 목록 조회 유스케이스임. */
@Injectable()
export class ListPortMappingsUseCase {
  private readonly logger = new Logger(ListPortMappingsUseCase.name);

  constructor(
    @Inject(UPNP_GATEWAY_REPOSITORY)
    private readonly gateway: IUpnpGatewayRepository,
  ) {}

  async execute(): Promise<PortMapping[]> {
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
}
