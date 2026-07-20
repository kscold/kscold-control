import { SetMetadata } from '@nestjs/common';
import type { AuditDomain } from '../../audit/domain/types/audit-event.type';

export const AUDIT_KEY = Symbol('audit');

/**
 * 감사 인터셉터에서 핸들러 실행 후 전달되는 컨텍스트.
 * extra: 컨트롤러에서 req._auditExtra 로 주입한 추가 데이터 (before 스냅샷 등).
 */
export interface AuditCtx {
  actorId: string | null;
  actorEmail: string | null;
  params: Record<string, string>;
  body: unknown;
  query: Record<string, unknown>;
  response: unknown;
  extra: Record<string, unknown>;
}

export interface AuditMeta {
  domain: AuditDomain;
  /**
   * 고정 문자열 또는 컨텍스트 기반 팩토리.
   * 실행 결과에 따라 동작이 갈리는 경우(예: 토글 → enable/disable)에 팩토리를 사용한다.
   */
  action: string | ((ctx: AuditCtx) => string);
  /** 고정 문자열 또는 컨텍스트 기반 팩토리 */
  summary: string | ((ctx: AuditCtx) => string);
  targetType?: string;
  /** 파라미터명 문자열 또는 컨텍스트 기반 팩토리 */
  targetId?: string | ((ctx: AuditCtx) => string | null);
  metadata?: (ctx: AuditCtx) => Record<string, unknown>;
}

/**
 * 감사 로그 기록을 인터셉터에 위임하는 AOP 데코레이터.
 *
 * @example
 * @Audit({
 *   domain: 'docker',
 *   action: 'container.start',
 *   summary: (ctx) => `컨테이너 ${ctx.params.id}를 시작했습니다.`,
 *   targetType: 'container',
 *   targetId: (ctx) => ctx.params.id,
 * })
 */
export const Audit = (meta: AuditMeta) => SetMetadata(AUDIT_KEY, meta);
