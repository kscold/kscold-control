import {
  ExecutionContext,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { DiagnosticJwtGuard } from '@/common/guards/diagnostic-jwt.guard';

describe('DiagnosticJwtGuard', () => {
  const context = {
    switchToHttp: () => ({
      getRequest: () => ({
        method: 'POST',
        headers: { authorization: 'Bearer test-only-secret' },
      }),
    }),
    getHandler: () => function uploadBatch() {},
  } as unknown as ExecutionContext;
  afterEach(() => jest.restoreAllMocks());

  it('preserves authenticated users', () => {
    const user = { id: 'user' };
    expect(
      new DiagnosticJwtGuard().handleRequest(null, user, undefined, context),
    ).toBe(user);
  });

  it.each(['TokenExpiredError', 'JsonWebTokenError', 'NotBeforeError'])(
    'rejects %s without logging credentials',
    (name) => {
      const log = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      expect(() =>
        new DiagnosticJwtGuard().handleRequest(null, null, { name }, context),
      ).toThrow(UnauthorizedException);
      expect(log).toHaveBeenCalled();
      expect(JSON.stringify(log.mock.calls)).not.toContain('test-only-secret');
    },
  );
});
