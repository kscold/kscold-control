import { Module } from '@nestjs/common';
import { NGINX_CONFIG_REPOSITORY } from './domain/repositories/nginx-config.repository.interface';
import { NGINX_RUNTIME_REPOSITORY } from './domain/repositories/nginx-runtime.repository.interface';
import { FileNginxConfigRepository } from './infrastructure/repositories/file-nginx-config.repository';
import { ShellNginxRuntimeRepository } from './infrastructure/repositories/shell-nginx-runtime.repository';

/**
 * Nginx 런타임 포트만 제공하는 경계 모듈입니다.
 * Docker 토폴로지가 설정을 읽기 위해 전체 NginxModule을 역참조하지 않게 합니다.
 */
@Module({
  providers: [
    { provide: NGINX_CONFIG_REPOSITORY, useClass: FileNginxConfigRepository },
    {
      provide: NGINX_RUNTIME_REPOSITORY,
      useClass: ShellNginxRuntimeRepository,
    },
  ],
  exports: [NGINX_CONFIG_REPOSITORY, NGINX_RUNTIME_REPOSITORY],
})
export class NginxInfrastructureModule {}
