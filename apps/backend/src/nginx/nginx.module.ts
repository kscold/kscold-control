import { Module } from '@nestjs/common';
import { NginxController } from './nginx.controller';
import { NginxService } from './nginx.service';
import { CertbotService } from './certbot.service';
import { DnsService } from './dns.service';
import { DockerModule } from '../docker/docker.module';

@Module({
  imports: [DockerModule],
  controllers: [NginxController],
  providers: [NginxService, CertbotService, DnsService],
})
export class NginxModule {}
