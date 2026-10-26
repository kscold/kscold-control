import { Logger } from '@nestjs/common';
import { LogFrontendErrorUseCase } from '@/logs/application/use-cases/log-frontend-error.use-case';
import { sanitizeFrontendDiagnostic } from '@/common/utils/frontend-diagnostic.util';
import { sanitizeHttpRequestBody } from '@/common/utils/http-log-sanitizer.util';
import { validate } from 'class-validator';
import { FrontendErrorRequestDto } from '@/logs/presentation/dto/frontend-error.request.dto';

describe('브라우저 진단 수집', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('허용된 원인·단계·상태만 기록하고 원문은 HTTP 로그에서도 제외함', () => {
    const logger = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    const payload = {
      kind: 'upload',
      route: '/repository',
      stage: 'batch',
      batchIndex: 7,
      code: 'integrity',
      httpStatus: 409,
      release: '1.4.1',
      message: 'fixture-never-log',
      stack: 'fixture-never-log',
      url: 'https://example.com/?private=fixture-never-log',
      componentStack: 'fixture-never-log',
      arbitrary: 'fixture-never-log',
    };
    expect(new LogFrontendErrorUseCase().execute(payload, 'user-a')).toBe(true);
    expect(logger).toHaveBeenCalledWith(
      expect.stringContaining('"stage":"batch"'),
    );
    expect(JSON.stringify(logger.mock.calls)).not.toContain(
      'fixture-never-log',
    );
    expect(
      JSON.stringify(
        sanitizeHttpRequestBody(payload, 'POST', '/api/logs/frontend-error'),
      ),
    ).not.toContain('fixture-never-log');
  });

  it('정해진 필드에 문자열을 주입해도 원문을 기록하지 않음', () => {
    const payload = Object.fromEntries(
      [
        'kind',
        'route',
        'code',
        'stage',
        'batchIndex',
        'httpStatus',
        'release',
        'errorType',
      ].map((key) => [key, 'fixture-never-log']),
    );
    expect(JSON.stringify(sanitizeFrontendDiagnostic(payload))).not.toContain(
      'fixture-never-log',
    );
    expect(
      sanitizeFrontendDiagnostic({
        batchIndex: Infinity,
        httpStatus: -1,
        release: '1.4.1\nprivate',
      }),
    ).toMatchObject({
      batchIndex: undefined,
      httpStatus: undefined,
      release: 'unknown',
    });
  });

  it('사용자별 분당 20건으로 제한하고 시간이 지나면 회복함', () => {
    jest.useFakeTimers();
    const logger = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    const useCase = new LogFrontendErrorUseCase();
    for (let i = 0; i < 20; i++)
      expect(useCase.execute({}, 'user-a')).toBe(true);
    expect(useCase.execute({}, 'user-a')).toBe(false);
    expect(useCase.execute({}, 'user-b')).toBe(true);
    jest.advanceTimersByTime(60000);
    expect(useCase.execute({}, 'user-a')).toBe(true);
    expect(logger).toHaveBeenCalledTimes(22);
  });

  it('다른 사용자로 메모리 제한을 우회하지 못함', () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    const useCase = new LogFrontendErrorUseCase();
    for (let i = 0; i < 1000; i++) useCase.execute({}, `user-${i}`);
    expect(useCase.execute({}, 'overflow')).toBe(false);
  });

  it('구형 요청을 받되 원문은 무시하고 잘못된 숫자·과도한 크기는 거부함', async () => {
    expect(
      await validate(
        Object.assign(new FrontendErrorRequestDto(), {
          message: 'legacy error',
        }),
      ),
    ).toHaveLength(0);
    expect(
      await validate(
        Object.assign(new FrontendErrorRequestDto(), {
          kind: 'upload',
          stage: 'batch',
          batchIndex: 3,
        }),
      ),
    ).toHaveLength(0);
    const errors = await validate(
      Object.assign(new FrontendErrorRequestDto(), {
        message: 'x'.repeat(4097),
        batchIndex: -1,
        httpStatus: 1000,
      }),
    );
    expect(errors).toHaveLength(3);
  });
});
