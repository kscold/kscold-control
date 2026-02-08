import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { winstonLogger } from '../logger/winston.config';

@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, ip, body, headers } = req;
    const userAgent = headers['user-agent'] || '';
    const token = headers.authorization || '';

    // 민감한 정보 마스킹 (password 등)
    const sanitizedBody = this.sanitizeBody(body);

    // 요청 시작 시간 기록
    const startTime = Date.now();

    // 응답 완료 시 로깅
    res.on('finish', () => {
      const { statusCode } = res;
      const responseTime = Date.now() - startTime;

      const logData = {
        timestamp: new Date().toISOString(),
        method,
        url: originalUrl,
        statusCode,
        responseTime: `${responseTime}ms`,
        ip: ip || req.socket.remoteAddress,
        userAgent,
        token: token ? this.maskToken(token) : 'none',
        body: sanitizedBody,
      };

      // winston의 http 레벨로 로깅
      winstonLogger.log('http', JSON.stringify(logData));

      // 에러 상태 코드는 별도 로깅
      if (statusCode >= 400) {
        winstonLogger.error(
          `${method} ${originalUrl} - ${statusCode} (${responseTime}ms)`,
          logData,
        );
      }
    });

    next();
  }

  // 민감한 정보 마스킹
  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') return body;

    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'secret', 'apiKey'];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '***REDACTED***';
      }
    }

    return sanitized;
  }

  // 토큰 마스킹 (앞 10자만 표시)
  private maskToken(token: string): string {
    if (token.length <= 20) return '***';
    return token.substring(0, 10) + '...' + token.substring(token.length - 5);
  }
}
