import { Module } from '@nestjs/common';
import { UpnpController } from './upnp.controller';
import { UpnpService } from './upnp.service';

@Module({
  controllers: [UpnpController],
  providers: [UpnpService],
  exports: [UpnpService],
})
export class UpnpModule {}
