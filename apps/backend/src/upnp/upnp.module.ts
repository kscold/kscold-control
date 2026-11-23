import { Module } from '@nestjs/common';
import { UpnpController } from './presentation/controllers/upnp.controller';
import {
  ListPortMappingsUseCase,
  AddPortMappingUseCase,
  RemovePortMappingUseCase,
  GetExternalIpUseCase,
} from './application/use-cases';
import { TcpUpnpGatewayRepository } from './infrastructure/repositories/tcp-upnp-gateway.repository';
import { UPNP_GATEWAY_REPOSITORY } from './domain/repositories/upnp-gateway.repository.interface';

@Module({
  controllers: [UpnpController],
  providers: [
    ListPortMappingsUseCase,
    AddPortMappingUseCase,
    RemovePortMappingUseCase,
    GetExternalIpUseCase,
    {
      provide: UPNP_GATEWAY_REPOSITORY,
      useClass: TcpUpnpGatewayRepository,
    },
  ],
  exports: [UPNP_GATEWAY_REPOSITORY],
})
export class UpnpModule {}
