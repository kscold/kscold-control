import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AuthModule } from './auth/auth.module';
import { ClaudeModule } from './claude/claude.module';
import { DockerModule } from './docker/docker.module';
import { SystemModule } from './system/system.module';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { Session } from './entities/session.entity';
import { Message } from './entities/message.entity';
import { Container } from './entities/container.entity';
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
      url:
        process.env.DATABASE_URL ||
        'postgresql://admin:admin123@localhost:5432/claude_infra',
      entities: [User, Role, Permission, Session, Message, Container],
      synchronize: process.env.NODE_ENV !== 'production',
      logging: process.env.NODE_ENV !== 'production',
    }),

    // 기능 모듈
    AuthModule,
    ClaudeModule,
    DockerModule,
    SystemModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HttpLoggerMiddleware).forRoutes('*');
  }
}
