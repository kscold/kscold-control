import { forwardRef, Module } from '@nestjs/common';
import { NginxController } from './presentation/controllers/nginx.controller';
import { NginxSiteService } from './application/services/nginx-site.service';
import { CertService } from './application/services/cert.service';
import { DnsService } from './application/services/dns.service';
import {
  ListNginxSitesUseCase,
  CreateNginxSiteUseCase,
  UpdateNginxSiteUseCase,
  DeleteNginxSiteUseCase,
  ToggleNginxSiteUseCase,
  TestNginxConfigUseCase,
  ReloadNginxUseCase,
  GetNginxUpstreamsUseCase,
  ListCertsUseCase,
  IssueCertUseCase,
  RenewCertsUseCase,
  GetCertRenewalStatusUseCase,
  GetPublicIpUseCase,
  VerifyDnsUseCase,
  VerifyAllDnsUseCase,
} from './application/use-cases';
import { NGINX_CONFIG_REPOSITORY } from './domain/repositories/nginx-config.repository';
import { NGINX_RUNTIME_REPOSITORY } from './domain/repositories/nginx-runtime.repository';
import { NginxConfigRepositoryImpl } from './infrastructure/repositories/nginx-config.repository.impl';
import { NginxRuntimeRepositoryImpl } from './infrastructure/repositories/nginx-runtime.repository.impl';
import { DockerModule } from '../docker/docker.module';

@Module({
  imports: [forwardRef(() => DockerModule)],
  controllers: [NginxController],
  providers: [
    // 인프라성 서비스: certbot/DNS/reload 등 시스템 로직 + CertService @Cron 스케줄러 보유.
    // use-case가 이 서비스들을 주입해 위임한다.
    NginxSiteService,
    CertService,
    DnsService,
    // Use-cases (컨트롤러 엔드포인트 1:1)
    ListNginxSitesUseCase,
    CreateNginxSiteUseCase,
    UpdateNginxSiteUseCase,
    DeleteNginxSiteUseCase,
    ToggleNginxSiteUseCase,
    TestNginxConfigUseCase,
    ReloadNginxUseCase,
    GetNginxUpstreamsUseCase,
    ListCertsUseCase,
    IssueCertUseCase,
    RenewCertsUseCase,
    GetCertRenewalStatusUseCase,
    GetPublicIpUseCase,
    VerifyDnsUseCase,
    VerifyAllDnsUseCase,
    { provide: NGINX_CONFIG_REPOSITORY, useClass: NginxConfigRepositoryImpl },
    { provide: NGINX_RUNTIME_REPOSITORY, useClass: NginxRuntimeRepositoryImpl },
  ],
  exports: [NGINX_RUNTIME_REPOSITORY, NGINX_CONFIG_REPOSITORY],
})
export class NginxModule {}
