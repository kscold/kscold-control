import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { SpaFallbackFilter } from './common/filters/spa-fallback.filter';
import { WinstonLoggerService } from './common/logger/winston.logger';
import {
  configuredProxyTrust,
  resolveClientIpAndDropProxySecret,
} from './common/utils/client-ip.util';

async function bootstrap() {
  // 모듈이 nginx 차단 목록 반영 같은 기동 작업을 하기 전에 설정 오류로 멈춘다.
  const proxyTrust = configuredProxyTrust();

  // bodyParser: false — multer(multipart)와 충돌 방지, 수동으로 body-parser 추가
  const app = await NestFactory.create(AppModule, {
    logger: new WinstonLoggerService(),
    bodyParser: false,
  });
  if (!proxyTrust.secret) {
    new Logger('ClientIp').warn(
      'CONTROL_PROXY_SECRET 이 비어 있어 믿는 프록시 주소에서 온 X-Real-IP 를 그대로 믿습니다. 같은 컴퓨터의 다른 프로세스도 이 헤더를 위조할 수 있습니다. 그래서 로그인 실패에 따른 자동 IP 차단(nginx·방화벽)과 허용 목록 예외는 꺼지고 계정 잠금만 걸립니다.',
    );
  }
  app.use(resolveClientIpAndDropProxySecret);

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
  // 외부 주소에서 바로 닿지 않게 루프백에만 연다. 같은 컴퓨터의 다른 프로세스와
  // VM 안 컨테이너도 루프백으로 들어오므로 X-Real-IP 는 CONTROL_PROXY_SECRET 으로 가린다.
  const host = process.env.CONTROL_BIND_HOST || '127.0.0.1';
  await app.listen(port, host);
  console.log(`Backend running on ${host} port ${port}`);
}

bootstrap();
