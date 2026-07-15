import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  type IUpnpGatewayRepository,
  UPNP_GATEWAY_REPOSITORY,
} from '../../domain/repositories/upnp-gateway.repository';
import { AddPortMappingDto } from '../dto';

/** UPnP 포트 매핑 추가 유스케이스임. */
@Injectable()
export class AddPortMappingUseCase {
  private readonly logger = new Logger(AddPortMappingUseCase.name);

  constructor(
    @Inject(UPNP_GATEWAY_REPOSITORY)
    private readonly gateway: IUpnpGatewayRepository,
  ) {}

  async execute(dto: AddPortMappingDto): Promise<{ success: boolean }> {
    try {
      await this.gateway.addMapping(dto.toDraft());
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
}
