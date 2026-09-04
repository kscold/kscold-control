import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { winstonLogger } from '../logger/winston.config';
import {
  sanitizeHttpRequestBody,
  sanitizeHttpRequestUrl,
} from '../utils/http-log-sanitizer.util';

@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, ip, body, headers } = req;
    const userAgent = headers['user-agent'] || '';
    const token = headers.authorization || '';

    const sanitizedBody = sanitizeHttpRequestBody(body, method, originalUrl);
    const sanitizedUrl = sanitizeHttpRequestUrl(originalUrl);

    // 요청 시작 시간 기록
    const startTime = Date.now();

    // 응답 완료 시 로깅
    res.on('finish', () => {
      const { statusCode } = res;
      const responseTime = Date.now() - startTime;

      const logData = {
        timestamp: new Date().toISOString(),
        method,
        url: sanitizedUrl,
        statusCode,
        responseTime: `${responseTime}ms`,
        ip: ip || req.socket.remoteAddress,
        userAgent,
        token: token ? this.maskToken() : 'none',
        body: sanitizedBody,
      };

      // winston의 http 레벨로 로깅
      winstonLogger.log('http', JSON.stringify(logData));

      // 에러 상태 코드는 별도 로깅
      if (statusCode >= 400) {
        winstonLogger.error(
          `${method} ${sanitizedUrl} - ${statusCode} (${responseTime}ms)`,
          logData,
        );
      }
    });

    next();
  }

  // 인증 토큰은 일부라도 로그에 남기지 않는다.
  private maskToken(): string {
    return '***REDACTED***';
  }
}
