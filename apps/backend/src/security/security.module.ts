import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NginxInfrastructureModule } from '../nginx/nginx-infrastructure.module';
import { IpBan } from './domain/entities/ip-ban.entity';
import { LoginAttempt } from './domain/entities/login-attempt.entity';
import { IP_BAN_REPOSITORY } from './domain/repositories/ip-ban.repository';
import { LOGIN_ATTEMPT_REPOSITORY } from './domain/repositories/login-attempt.repository';
import { NGINX_BLOCKLIST_WRITER } from './domain/repositories/nginx-blocklist.writer';
import { IpBanRepositoryImpl } from './infrastructure/repositories/ip-ban.repository.impl';
import { LoginAttemptRepositoryImpl } from './infrastructure/repositories/login-attempt.repository.impl';
import { NginxBlocklistWriterImpl } from './infrastructure/writers/nginx-blocklist.writer.impl';
import { IP_GEO_READER } from './domain/repositories/ip-geo.reader';
import { ipGeoReaderFromEnv } from './infrastructure/readers/ip-geo.reader.impl';
import { AttackMapService } from './application/services/attack-map.service';
import { IpBanService } from './application/services/ip-ban.service';
import { IpAllowlistService } from './application/services/ip-allowlist.service';
import { LoginGuardService } from './application/services/login-guard.service';
import {
  CreateIpBanUseCase,
  DeleteIpBanUseCase,
  ListIpBansUseCase,
  ResyncBlocklistUseCase,
} from './application/use-cases';
import { SecurityController } from './presentation/controllers/security.controller';
import { SshAccessController } from './presentation/controllers/ssh-access.controller';
import { SshAccessService } from './application/services/ssh-access.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([IpBan, LoginAttempt]),
    NginxInfrastructureModule,
  ],
  controllers: [SecurityController, SshAccessController],
  providers: [
    IpBanService,
    IpAllowlistService,
    SshAccessService,
    AttackMapService,
    LoginGuardService,
    ListIpBansUseCase,
    CreateIpBanUseCase,
    DeleteIpBanUseCase,
    ResyncBlocklistUseCase,
    { provide: IP_BAN_REPOSITORY, useClass: IpBanRepositoryImpl },
    { provide: LOGIN_ATTEMPT_REPOSITORY, useClass: LoginAttemptRepositoryImpl },
    { provide: NGINX_BLOCKLIST_WRITER, useClass: NginxBlocklistWriterImpl },
    { provide: IP_GEO_READER, useFactory: ipGeoReaderFromEnv },
  ],
  exports: [IpBanService, LoginGuardService],
})
export class SecurityModule {}
