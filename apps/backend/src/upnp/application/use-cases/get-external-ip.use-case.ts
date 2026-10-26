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

/** UPnP를 통한 외부 IP 조회 유스케이스임. */
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
      const failure =
        err instanceof UpnpQueryError
          ? err
          : new UpnpQueryError('UPNP_QUERY_FAILED');
      this.logger.warn(`UPnP external IP unavailable: ${failure.code}`);
      throw new ServiceUnavailableException({
        code: failure.code,
        message: failure.message,
      });
    }
  }
}
