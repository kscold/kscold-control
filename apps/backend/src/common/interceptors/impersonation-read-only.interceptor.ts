import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { JwtRequest } from '../types/jwt-request.type';

const SAFE_HTTP_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** QA 사용자 미리보기 토큰으로는 서버 상태를 바꾸지 못하게 막는다. */
@Injectable()
export class ImpersonationReadOnlyInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const request = context
      .switchToHttp()
      .getRequest<JwtRequest & { method?: string }>();
    const method = request.method?.toUpperCase() ?? 'GET';

    if (request.user?.impersonation && !SAFE_HTTP_METHODS.has(method)) {
      throw new ForbiddenException(
        'QA 사용자 미리보기에서는 변경 작업을 실행할 수 없습니다.',
      );
    }

    return next.handle();
  }
}
