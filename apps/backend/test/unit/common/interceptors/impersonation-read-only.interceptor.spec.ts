import { ForbiddenException } from '@nestjs/common';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { ImpersonationReadOnlyInterceptor } from '@/common/interceptors/impersonation-read-only.interceptor';

describe('ImpersonationReadOnlyInterceptor', () => {
  const reflector = { get: jest.fn().mockReturnValue(false) };
  const interceptor = new ImpersonationReadOnlyInterceptor(reflector as any);

  beforeEach(() => {
    reflector.get.mockReset().mockReturnValue(false);
  });

  function context(method: string, impersonating: boolean) {
    return {
      getType: () => 'http',
      getHandler: () => jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          method,
          user: impersonating
            ? {
                id: 'target-user',
                impersonation: { readOnly: true },
              }
            : { id: 'admin-user' },
        }),
      }),
    } as unknown as ExecutionContext;
  }

  it('미리보기의 GET 요청은 통과시킨다', () => {
    const next = { handle: jest.fn(() => of({ ok: true })) } as CallHandler;

    interceptor.intercept(context('GET', true), next);

    expect(next.handle).toHaveBeenCalledTimes(1);
  });

  it('미리보기의 쓰기 요청은 컨트롤러 실행 전에 거부한다', () => {
    const next = { handle: jest.fn(() => of({ ok: true })) } as CallHandler;

    expect(() => interceptor.intercept(context('PATCH', true), next)).toThrow(
      ForbiddenException,
    );
    expect(next.handle).not.toHaveBeenCalled();
  });

  it('일반 관리자 토큰의 쓰기 요청은 그대로 통과시킨다', () => {
    const next = { handle: jest.fn(() => of({ ok: true })) } as CallHandler;

    interceptor.intercept(context('POST', false), next);

    expect(next.handle).toHaveBeenCalledTimes(1);
  });

  it('명시적으로 허용된 읽기 성격의 POST 요청은 통과시킨다', () => {
    reflector.get.mockReturnValue(true);
    const next = { handle: jest.fn(() => of({ ok: true })) } as CallHandler;

    interceptor.intercept(context('POST', true), next);

    expect(next.handle).toHaveBeenCalledTimes(1);
  });
});
