import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { join } from 'path';

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

    // 그 외 경로는 index.html 반환 (React Router)
    // __dirname은 dist/ 폴더이므로 상위로 3단계 올라가서 apps/frontend/dist로 이동
    response.sendFile(
      join(__dirname, '..', '..', '..', '..', 'frontend', 'dist', 'index.html'),
    );
  }
}
