import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AuditLogService } from '../../audit/application/services/audit-log.service';
import { AUDIT_KEY, type AuditCtx, type AuditMeta } from '../decorators/audit.decorator';
import type { JwtRequest } from '../types/jwt-request.type';

/** req 에 컨트롤러가 주입할 수 있는 before 스냅샷 등 추가 데이터 */
interface AuditRequest extends JwtRequest {
  _auditExtra?: Record<string, unknown>;
  params: Record<string, string>;
  body: unknown;
  query: Record<string, unknown>;
}

/**
 * AuditInterceptor
 *
 * @Audit() 데코레이터가 붙은 핸들러 실행 후 감사 로그를 자동으로 기록합니다.
 * 컨트롤러에서 AuditLogService 를 직접 주입하거나 호출할 필요가 없습니다.
 *
 * before 스냅샷이 필요한 경우 컨트롤러에서 아래처럼 요청 객체에 주입하세요:
 *   (req as AuditRequest)._auditExtra = { before: snapshot };
 * 그러면 @Audit metadata factory 에서 ctx.extra.before 로 접근할 수 있습니다.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditLogService: AuditLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.get<AuditMeta | undefined>(AUDIT_KEY, context.getHandler());
    if (!meta) return next.handle();

    const req = context.switchToHttp().getRequest<AuditRequest>();
    const actorId = req.user?.id ?? req.user?.sub ?? null;
    const actorEmail = req.user?.email ?? null;

    return next.handle().pipe(
      tap((response) => {
        const ctx: AuditCtx = {
          actorId,
          actorEmail,
          params: req.params ?? {},
          body: req.body,
          query: req.query ?? {},
          response,
          extra: req._auditExtra ?? {},
        };

        const summary = typeof meta.summary === 'function' ? meta.summary(ctx) : meta.summary;
        const targetId =
          typeof meta.targetId === 'function'
            ? meta.targetId(ctx)
            : (meta.targetId ?? null);
        const metadata = meta.metadata ? meta.metadata(ctx) : undefined;

        // fire-and-forget: 감사 실패가 요청을 막아서는 안 됨
        void this.auditLogService
          .record({
            domain: meta.domain,
            action: meta.action,
            summary,
            actorId,
            actorEmail,
            targetType: meta.targetType ?? null,
            targetId,
            metadata,
          })
          .catch((err: Error) => {
            this.logger.error(
              `감사 로그 기록 실패 — action: ${meta.action}, reason: ${err.message}`,
              err.stack,
            );
          });
      }),
    );
  }
}
