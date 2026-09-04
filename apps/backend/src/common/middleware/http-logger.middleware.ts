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
        url: this.sanitizeUrl(originalUrl),
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
          `${method} ${originalUrl} - ${statusCode} (${responseTime}ms)`,
          logData,
        );
      }
    });

    next();
  }

  // 민감한 정보 마스킹
  private sanitizeBody(body: unknown): unknown {
    return this.sanitizeValue(body, new WeakSet<object>());
  }

  private sanitizeValue(value: unknown, seen: WeakSet<object>): unknown {
    if (!value || typeof value !== 'object') return value;
    if (seen.has(value)) return '[Circular]';
    seen.add(value);

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeValue(item, seen));
    }

    const sensitiveFields = new Set([
      'password',
      'token',
      'accesstoken',
      'refreshtoken',
      'authorization',
      'secret',
      'secretvalue',
      'apikey',
      'envfile',
      'encryptedpayload',
      'authtag',
      'iv',
    ]);
    const sanitized: Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(value)) {
      const normalizedKey = key.replace(/[-_]/g, '').toLowerCase();
      sanitized[key] = sensitiveFields.has(normalizedKey)
        ? '***REDACTED***'
        : this.sanitizeValue(nestedValue, seen);
    }

    return sanitized;
  }

  // 인증 토큰은 일부라도 로그에 남기지 않는다.
  private maskToken(): string {
    return '***REDACTED***';
  }

  private sanitizeUrl(originalUrl: string): string {
    try {
      const url = new URL(originalUrl, 'http://localhost');
      for (const key of ['token', 'access_token', 'refresh_token']) {
        url.searchParams.delete(key);
      }
      return `${url.pathname}${url.search}`;
    } catch {
      return originalUrl.replace(
        /([?&](?:token|access_token|refresh_token)=)[^&]*/gi,
        '$1***REDACTED***',
      );
    }
  }
}
