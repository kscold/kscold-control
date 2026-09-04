import { Module } from '@nestjs/common';
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
import { DockerModule } from '../docker/docker.module';
import { NginxInfrastructureModule } from './nginx-infrastructure.module';

@Module({
  imports: [DockerModule, NginxInfrastructureModule],
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
  ],
})
export class NginxModule {}
