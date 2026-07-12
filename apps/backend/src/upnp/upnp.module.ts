import { Module } from '@nestjs/common';
import { UpnpController } from './presentation/controllers/upnp.controller';
import { UpnpService } from './application/services/upnp.service';
import { UpnpGatewayRepositoryImpl } from './infrastructure/repositories/upnp-gateway.repository.impl';
import { UPNP_GATEWAY_REPOSITORY } from './domain/interfaces/upnp-gateway.repository';

@Module({
  controllers: [UpnpController],
  providers: [
    UpnpService,
    {
      provide: UPNP_GATEWAY_REPOSITORY,
      useClass: UpnpGatewayRepositoryImpl,
    },
  ],
  exports: [UpnpService, UPNP_GATEWAY_REPOSITORY],
})
export class UpnpModule {}
