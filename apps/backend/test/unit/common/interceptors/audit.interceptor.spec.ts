import { of } from 'rxjs';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { AuditInterceptor } from '../../../../src/common/interceptors/audit.interceptor';
import type {
  AuditCtx,
  AuditMeta,
} from '../../../../src/common/decorators/audit.decorator';
import type { AuditLogService } from '../../../../src/audit/application/services/audit-log.service';

/**
 * 감사 인터셉터가 @Audit 메타데이터를 어떻게 해석해 기록하는지 검증한다.
 * 특히 action/summary/targetId 를 고정 문자열과 컨텍스트 팩토리 양쪽으로 받을 수 있어야 한다.
 */
describe('AuditInterceptor', () => {
  const recordMock = jest.fn().mockResolvedValue(undefined);
  const auditLogService = { record: recordMock } as unknown as AuditLogService;

  /** @Audit 메타데이터와 요청/응답을 주고 실제 기록된 인자를 돌려준다. */
  async function runInterceptor(
    meta: AuditMeta,
    options: {
      response?: unknown;
      params?: Record<string, string>;
      body?: unknown;
      auditExtra?: Record<string, unknown>;
    } = {},
  ) {
    const reflector = {
      get: jest.fn().mockReturnValue(meta),
    } as unknown as Reflector;
    const interceptor = new AuditInterceptor(reflector, auditLogService);

    const request = {
      user: { id: 'user-1', email: 'admin@example.com' },
      params: options.params ?? {},
      body: options.body ?? {},
      query: {},
      _auditExtra: options.auditExtra,
    };
    const context = {
      getHandler: () => jest.fn(),
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    const next = {
      handle: () => of(options.response ?? {}),
    } as CallHandler;

    await new Promise<void>((resolve, reject) => {
      interceptor
        .intercept(context, next)
        .subscribe({ complete: resolve, error: reject });
    });
    // record 는 fire-and-forget 이라 마이크로태스크가 비워질 때까지 기다린다
    await Promise.resolve();

    return recordMock.mock.calls.at(-1)?.[0];
  }

  beforeEach(() => {
    recordMock.mockClear();
  });

  it('@Audit 이 없는 핸들러는 감사 로그를 남기지 않는다', async () => {
    const reflector = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const interceptor = new AuditInterceptor(reflector, auditLogService);
    const context = {
      getHandler: () => jest.fn(),
      switchToHttp: () => ({ getRequest: () => ({}) }),
    } as unknown as ExecutionContext;

    await new Promise<void>((resolve, reject) => {
      interceptor
        .intercept(context, { handle: () => of({}) } as CallHandler)
        .subscribe({ complete: resolve, error: reject });
    });

    expect(recordMock).not.toHaveBeenCalled();
  });

  it('고정 문자열 action·summary 를 그대로 기록한다', async () => {
    const recorded = await runInterceptor({
      domain: 'nginx',
      action: 'reload',
      summary: 'Nginx 리로드를 실행했습니다.',
      targetType: 'service',
      targetId: 'kscold-nginx',
    });

    expect(recorded).toMatchObject({
      domain: 'nginx',
      action: 'reload',
      summary: 'Nginx 리로드를 실행했습니다.',
      targetType: 'service',
      targetId: 'kscold-nginx',
      actorId: 'user-1',
      actorEmail: 'admin@example.com',
    });
  });

  it('action 팩토리가 응답에 따라 다른 action 을 만든다 (사이트 활성화)', async () => {
    const action = (ctx: AuditCtx) =>
      (ctx.response as { enabled: boolean }).enabled
        ? 'site.enable'
        : 'site.disable';

    const recorded = await runInterceptor(
      {
        domain: 'nginx',
        action,
        summary: (ctx) =>
          `Nginx 사이트 ${ctx.params.name}를 ${
            (ctx.response as { enabled: boolean }).enabled
              ? '활성화'
              : '비활성화'
          }했습니다.`,
        targetType: 'site',
        targetId: (ctx) => ctx.params.name,
      },
      { params: { name: 'blog' }, response: { enabled: true } },
    );

    expect(recorded.action).toBe('site.enable');
    expect(recorded.summary).toBe('Nginx 사이트 blog를 활성화했습니다.');
    expect(recorded.targetId).toBe('blog');
  });

  it('action 팩토리가 응답에 따라 다른 action 을 만든다 (사이트 비활성화)', async () => {
    const recorded = await runInterceptor(
      {
        domain: 'nginx',
        action: (ctx) =>
          (ctx.response as { enabled: boolean }).enabled
            ? 'site.enable'
            : 'site.disable',
        summary: (ctx) =>
          `Nginx 사이트 ${ctx.params.name}를 ${
            (ctx.response as { enabled: boolean }).enabled
              ? '활성화'
              : '비활성화'
          }했습니다.`,
        targetType: 'site',
        targetId: (ctx) => ctx.params.name,
      },
      { params: { name: 'blog' }, response: { enabled: false } },
    );

    expect(recorded.action).toBe('site.disable');
    expect(recorded.summary).toBe('Nginx 사이트 blog를 비활성화했습니다.');
  });

  it('컨트롤러가 넣은 _auditExtra 를 metadata 팩토리에서 쓸 수 있다', async () => {
    const before = { name: 'blog', enabled: false };

    const recorded = await runInterceptor(
      {
        domain: 'nginx',
        action: 'site.update',
        summary: '수정',
        metadata: (ctx) => ({
          before: (ctx.extra as { before?: unknown }).before ?? null,
          after: ctx.response,
        }),
      },
      { auditExtra: { before }, response: { name: 'blog', enabled: true } },
    );

    expect(recorded.metadata).toEqual({
      before,
      after: { name: 'blog', enabled: true },
    });
  });

  it('targetId 가 없으면 null 로 기록한다', async () => {
    const recorded = await runInterceptor({
      domain: 'nginx',
      action: 'test',
      summary: '검사',
    });

    expect(recorded.targetId).toBeNull();
    expect(recorded.targetType).toBeNull();
  });
});
