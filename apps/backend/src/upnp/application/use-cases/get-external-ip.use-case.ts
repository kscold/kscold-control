import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  type IUpnpGatewayRepository,
  UPNP_GATEWAY_REPOSITORY,
} from '../../domain/repositories/upnp-gateway.repository';

/** UPnP를 통한 외부 IP 조회 */
@Injectable()
export class GetExternalIpUseCase {
  private readonly logger = new Logger(GetExternalIpUseCase.name);

  constructor(
    @Inject(UPNP_GATEWAY_REPOSITORY)
    private readonly gateway: IUpnpGatewayRepository,
  ) {}

  async execute(): Promise<string> {
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
