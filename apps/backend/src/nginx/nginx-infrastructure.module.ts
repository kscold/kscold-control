import { Module } from '@nestjs/common';
import { NGINX_CONFIG_REPOSITORY } from './domain/repositories/nginx-config.repository';
import { NGINX_RUNTIME_REPOSITORY } from './domain/repositories/nginx-runtime.repository';
import { NginxConfigRepositoryImpl } from './infrastructure/repositories/nginx-config.repository.impl';
import { NginxRuntimeRepositoryImpl } from './infrastructure/repositories/nginx-runtime.repository.impl';

/**
 * Nginx 런타임 포트만 제공하는 경계 모듈입니다.
 * Docker 토폴로지가 설정을 읽기 위해 전체 NginxModule을 역참조하지 않게 합니다.
 */
@Module({
  providers: [
    { provide: NGINX_CONFIG_REPOSITORY, useClass: NginxConfigRepositoryImpl },
    { provide: NGINX_RUNTIME_REPOSITORY, useClass: NginxRuntimeRepositoryImpl },
  ],
  exports: [NGINX_CONFIG_REPOSITORY, NGINX_RUNTIME_REPOSITORY],
})
export class NginxInfrastructureModule {}
