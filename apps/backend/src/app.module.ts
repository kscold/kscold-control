import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AuthModule } from './auth/auth.module';
import { TerminalModule } from './terminal/terminal.module';
import { DockerModule } from './docker/docker.module';
import { SystemModule } from './system/system.module';
import { RbacModule } from './rbac/rbac.module';
import { LogsModule } from './logs/logs.module';
import { NginxModule } from './nginx/nginx.module';
import { UpnpModule } from './upnp/upnp.module';

// Domain Entities (Clean Architecture)
import { User } from './rbac/domain/entities/user.entity';
import { Role } from './rbac/domain/entities/role.entity';
import { Permission } from './rbac/domain/entities/permission.entity';
import { Session } from './terminal/domain/entities/session.entity';
import { Message } from './terminal/domain/entities/message.entity';
import { Container } from './docker/domain/entities/container.entity';

import { HttpLoggerMiddleware } from './common/middleware/http-logger.middleware';

@Module({
  imports: [
    // 환경 변수
    ConfigModule.forRoot({ isGlobal: true }),

    // React 빌드 파일 서빙 (프로덕션)
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'frontend', 'dist'),
      exclude: ['/api/(.*)'], // API 라우트만 제외, SPA 라우팅(/docker, /claude 등)은 index.html로
      serveRoot: '/',
    }),

    // TypeORM + PostgreSQL
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [User, Role, Permission, Session, Message, Container],
      synchronize: process.env.NODE_ENV !== 'production',
      logging: process.env.NODE_ENV !== 'production',
    }),

    // 기능 모듈
    AuthModule,
    TerminalModule,
    DockerModule,
    SystemModule,
    RbacModule,
    LogsModule,
    NginxModule,
    UpnpModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HttpLoggerMiddleware).forRoutes('*');
  }
}
