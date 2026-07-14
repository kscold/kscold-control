import { Module } from '@nestjs/common';
import { UpnpController } from './presentation/controllers/upnp.controller';
import {
  ListPortMappingsUseCase,
  AddPortMappingUseCase,
  RemovePortMappingUseCase,
  GetExternalIpUseCase,
} from './application/use-cases';
import { UpnpGatewayRepositoryImpl } from './infrastructure/repositories/upnp-gateway.repository.impl';
import { UPNP_GATEWAY_REPOSITORY } from './domain/repositories/upnp-gateway.repository';

@Module({
  controllers: [UpnpController],
  providers: [
    ListPortMappingsUseCase,
    AddPortMappingUseCase,
    RemovePortMappingUseCase,
    GetExternalIpUseCase,
    {
      provide: UPNP_GATEWAY_REPOSITORY,
      useClass: UpnpGatewayRepositoryImpl,
    },
  ],
  exports: [UPNP_GATEWAY_REPOSITORY],
})
export class UpnpModule {}
