import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { UpnpQueryError } from '../../domain/errors/upnp-query.error';

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
      const failure =
        err instanceof UpnpQueryError
          ? err
          : new UpnpQueryError('UPNP_QUERY_FAILED');
      this.logger.warn(`UPnP mappings unavailable: ${failure.code}`);
      throw new ServiceUnavailableException({
        code: failure.code,
        message: failure.message,
      });
    }
  }
}
