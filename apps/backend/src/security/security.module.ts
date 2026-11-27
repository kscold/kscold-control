import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NginxInfrastructureModule } from '../nginx/nginx-infrastructure.module';
import { IpBan } from './domain/entities/ip-ban.entity';
import { LoginAttempt } from './domain/entities/login-attempt.entity';
import { IP_BAN_REPOSITORY } from './domain/repositories/ip-ban.repository.interface';
import { LOGIN_ATTEMPT_REPOSITORY } from './domain/repositories/login-attempt.repository.interface';
import { NGINX_BLOCKLIST_WRITER } from './domain/gateways/nginx-blocklist.gateway.interface';
import { TypeOrmIpBanRepository } from './infrastructure/repositories/typeorm-ip-ban.repository';
import { TypeOrmLoginAttemptRepository } from './infrastructure/repositories/typeorm-login-attempt.repository';
import { FileNginxBlocklistGateway } from './infrastructure/gateways/file-nginx-blocklist.gateway';
import { IP_GEO_READER } from './domain/gateways/ip-geo.gateway.interface';
import { ipGeoReaderFromEnv } from './infrastructure/gateways/mmdb-ip-geo.gateway';
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
import { SshCountryGuardService } from './application/services/ssh-country-guard.service';
import { GetSshAllowUsersUseCase } from './application/use-cases/get-ssh-allow-users.use-case';
import { SSH_ALLOW_USERS } from './domain/gateways/ssh-allow-users.gateway.interface';
import { FileSshAllowUsersGateway } from './infrastructure/gateways/file-ssh-allow-users.gateway';

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
    SshCountryGuardService,
    AttackMapService,
    LoginGuardService,
    ListIpBansUseCase,
    CreateIpBanUseCase,
    DeleteIpBanUseCase,
    ResyncBlocklistUseCase,
    GetSshAllowUsersUseCase,
    { provide: SSH_ALLOW_USERS, useClass: FileSshAllowUsersGateway },
    { provide: IP_BAN_REPOSITORY, useClass: TypeOrmIpBanRepository },
    { provide: LOGIN_ATTEMPT_REPOSITORY, useClass: TypeOrmLoginAttemptRepository },
    { provide: NGINX_BLOCKLIST_WRITER, useClass: FileNginxBlocklistGateway },
    { provide: IP_GEO_READER, useFactory: ipGeoReaderFromEnv },
  ],
  exports: [IpBanService, LoginGuardService],
})
export class SecurityModule {}
