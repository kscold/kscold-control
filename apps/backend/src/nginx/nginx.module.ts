import { forwardRef, Module } from '@nestjs/common';
import { NginxController } from './presentation/controllers/nginx.controller';
import { NginxSiteService } from './application/services/nginx-site.service';
import { CertService } from './application/services/cert.service';
import { DnsService } from './application/services/dns.service';
import { NGINX_CONFIG_REPOSITORY } from './domain/interfaces/nginx-config.repository';
import { NGINX_RUNTIME_REPOSITORY } from './domain/interfaces/nginx-runtime.repository';
import { NginxConfigRepositoryImpl } from './infrastructure/repositories/nginx-config.repository.impl';
import { NginxRuntimeRepositoryImpl } from './infrastructure/repositories/nginx-runtime.repository.impl';
import { DockerModule } from '../docker/docker.module';

@Module({
  imports: [forwardRef(() => DockerModule)],
  controllers: [NginxController],
  providers: [
    NginxSiteService,
    CertService,
    DnsService,
    { provide: NGINX_CONFIG_REPOSITORY, useClass: NginxConfigRepositoryImpl },
    { provide: NGINX_RUNTIME_REPOSITORY, useClass: NginxRuntimeRepositoryImpl },
  ],
  exports: [NGINX_RUNTIME_REPOSITORY, NGINX_CONFIG_REPOSITORY],
})
export class NginxModule {}
