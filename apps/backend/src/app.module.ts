import { APP_INTERCEPTOR } from '@nestjs/core';
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AuthModule } from './auth/auth.module';
import { TerminalModule } from './terminal/terminal.module';
import { DockerModule } from './docker/docker.module';
import { SystemModule } from './system/system.module';
import { RbacModule } from './rbac/rbac.module';
import { LogsModule } from './logs/logs.module';
import { NginxModule } from './nginx/nginx.module';
import { UpnpModule } from './upnp/upnp.module';
import { ClaudeChatModule } from './claude-chat/claude-chat.module';
import { OpenAIChatModule } from './openai-chat/openai-chat.module';
import { RepositoryModule } from './repository/repository.module';
import { AuditModule } from './audit/audit.module';
import { SecurityModule } from './security/security.module';
import { KeyManagementModule } from './key-management/key-management.module';
import { ReleaseModule } from './release/release.module';

// 도메인 엔티티 (클린 아키텍처)
import { User } from './rbac/domain/entities/user.entity';
import { Role } from './rbac/domain/entities/role.entity';
import { Permission } from './rbac/domain/entities/permission.entity';
import { KeyManagementTargetAccess } from './rbac/domain/entities/key-management-target-access.entity';
import { Session } from './terminal/domain/entities/session.entity';
import { Message } from './terminal/domain/entities/message.entity';
import { Container } from './docker/domain/entities/container.entity';
import { TopologyNodeLayout } from './docker/domain/entities/topology-node-layout.entity';
import { Project } from './repository/domain/entities/project.entity';
import { IpBan } from './security/domain/entities/ip-ban.entity';
import { SecretBackup } from './key-management/domain/entities/secret-backup.entity';
import { KeyManagementTargetEntity } from './key-management/domain/entities/key-management-target.entity';

import { HttpLoggerMiddleware } from './common/middleware/http-logger.middleware';
import {
  AuditInterceptor,
  ImpersonationReadOnlyInterceptor,
} from './common/interceptors';
import { shouldSynchronizeDatabase } from './common/utils/database-synchronize.util';
import { resolveFrontendDistPath } from './common/utils/frontend-dist-path.util';

@Module({
  imports: [
    // 환경 변수
    ConfigModule.forRoot({ isGlobal: true }),

    // 스케줄러 (SSL 인증서 자동 갱신 등)
    ScheduleModule.forRoot(),

    // React 빌드 파일 서빙 (프로덕션)
    ServeStaticModule.forRoot({
      rootPath: resolveFrontendDistPath(),
      // Express 5 / path-to-regexp v8에서는 '/api/(.*)' 형식을 쓸 수 없다.
      exclude: ['/api/{*any}'], // API 라우트만 제외, SPA 라우팅(/docker, /claude 등)은 index.html로
    }),

    // TypeORM + PostgreSQL
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [
        User,
        Role,
        Permission,
        KeyManagementTargetAccess,
        Session,
        Message,
        Container,
        TopologyNodeLayout,
        Project,
        IpBan,
        SecretBackup,
        KeyManagementTargetEntity,
      ],
      synchronize: shouldSynchronizeDatabase(),
      logging: process.env.NODE_ENV !== 'production',
    }),

    // 기능 모듈
    AuthModule,
    TerminalModule,
    DockerModule,
    SystemModule,
    RbacModule,
    LogsModule,
    AuditModule,
    NginxModule,
    UpnpModule,
    ClaudeChatModule,
    OpenAIChatModule,
    RepositoryModule,
    SecurityModule,
    KeyManagementModule,
    ReleaseModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ImpersonationReadOnlyInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Express 5: 이름 없는 '*' 대신 named 와일드카드('{*splat}')를 사용한다.
    consumer.apply(HttpLoggerMiddleware).forRoutes('{*splat}');
  }
}
