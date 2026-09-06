import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { join } from 'path';
import { resolveFrontendDistPath } from '../utils/frontend-dist-path.util';

@Catch(NotFoundException)
export class SpaFallbackFilter implements ExceptionFilter {
  catch(exception: NotFoundException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    // API 경로는 404 응답 반환
    if (request.url.startsWith('/api/')) {
      response.status(404).json({
        statusCode: 404,
        message: 'Cannot ' + request.method + ' ' + request.url,
        error: 'Not Found',
      });
      return;
    }

    // 운영에서는 원자적으로 발행된 정적 릴리스, 개발에서는 일반 dist를 사용한다.
    response.sendFile(join(resolveFrontendDistPath(), 'index.html'));
  }
}
