import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NginxModule } from '../nginx/nginx.module';
import { IpBan } from './domain/entities/ip-ban.entity';
import { IP_BAN_REPOSITORY } from './domain/repositories/ip-ban.repository';
import { NGINX_BLOCKLIST_WRITER } from './domain/repositories/nginx-blocklist.writer';
import { IpBanRepositoryImpl } from './infrastructure/repositories/ip-ban.repository.impl';
import { NginxBlocklistWriterImpl } from './infrastructure/writers/nginx-blocklist.writer.impl';
import { IpBanService } from './application/services/ip-ban.service';
import { IpAllowlistService } from './application/services/ip-allowlist.service';
import {
  CreateIpBanUseCase,
  DeleteIpBanUseCase,
  ListIpBansUseCase,
  ResyncBlocklistUseCase,
} from './application/use-cases';
import { SecurityController } from './presentation/controllers/security.controller';

@Module({
  imports: [TypeOrmModule.forFeature([IpBan]), NginxModule],
  controllers: [SecurityController],
  providers: [
    IpBanService,
    IpAllowlistService,
    ListIpBansUseCase,
    CreateIpBanUseCase,
    DeleteIpBanUseCase,
    ResyncBlocklistUseCase,
    { provide: IP_BAN_REPOSITORY, useClass: IpBanRepositoryImpl },
    { provide: NGINX_BLOCKLIST_WRITER, useClass: NginxBlocklistWriterImpl },
  ],
  exports: [IpBanService],
})
export class SecurityModule {}
