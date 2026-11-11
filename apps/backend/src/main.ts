import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { SpaFallbackFilter } from './common/filters/spa-fallback.filter';
import { WinstonLoggerService } from './common/logger/winston.logger';
import { configuredTrustedProxies } from './common/utils/client-ip.util';

async function bootstrap() {
  // 모듈이 nginx 차단 목록 반영 같은 기동 작업을 하기 전에 설정 오류로 멈춘다.
  configuredTrustedProxies();

  // bodyParser: false — multer(multipart)와 충돌 방지, 수동으로 body-parser 추가
  const app = await NestFactory.create(AppModule, {
    logger: new WinstonLoggerService(),
    bodyParser: false,
  });

  // 소스 저장소 청크 업로드 대비 — 배치당 ~50MB 허용
  app.use(json({ limit: '100mb' }));
  app.use(urlencoded({ extended: true, limit: '100mb' }));

  // CORS 설정
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  // 글로벌 Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // SPA Fallback Filter (404 처리)
  app.useGlobalFilters(new SpaFallbackFilter());

  // 글로벌 prefix
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 4000;
  // 같은 컴퓨터의 nginx 만 닿게 하여 X-Real-IP 위조 경로를 없앤다.
  const host = process.env.CONTROL_BIND_HOST || '127.0.0.1';
  await app.listen(port, host);
  console.log(`Backend running on ${host} port ${port}`);
}

bootstrap();
