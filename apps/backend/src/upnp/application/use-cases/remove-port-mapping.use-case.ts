import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  type IUpnpGatewayRepository,
  UPNP_GATEWAY_REPOSITORY,
} from '../../domain/repositories/upnp-gateway.repository';

/** UPnP 포트 매핑 삭제 유스케이스임. */
@Injectable()
export class RemovePortMappingUseCase {
  private readonly logger = new Logger(RemovePortMappingUseCase.name);

  constructor(
    @Inject(UPNP_GATEWAY_REPOSITORY)
    private readonly gateway: IUpnpGatewayRepository,
  ) {}

  async execute(
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
}
