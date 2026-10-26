import { AxiosError } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BaseApiService } from './base.service';
import { ApiError } from './api-error';

class TestService extends BaseApiService {
  fail(error: unknown): never {
    return this.handleError(error, 'fallback');
  }
  log(error: unknown): void {
    this.logError('TestService', 'request', error);
  }
}

describe('API 오류 진단 경계', () => {
  afterEach(() => vi.restoreAllMocks());
  it('요청 본문·토큰은 제외하고 상태와 코드를 보존함', () => {
    const error = new AxiosError('network error', 'ERR_BAD_RESPONSE');
    error.response = {
      status: 503,
      data: { message: '연결 불가', code: 'UPNP_UNAVAILABLE' },
    } as AxiosError['response'];
    error.config = {
      headers: { Authorization: 'fixture-never-log' },
      data: 'fixture-never-log',
    } as AxiosError['config'];
    const service = new TestService();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    service.log(error);
    expect(JSON.stringify(warn.mock.calls)).not.toContain('fixture-never-log');
    try {
      service.fail(error);
    } catch (failure) {
      expect(failure).toBeInstanceOf(ApiError);
      expect(failure).toMatchObject({
        status: 503,
        code: 'UPNP_UNAVAILABLE',
        message: '연결 불가',
      });
      expect(JSON.stringify(failure)).not.toContain('fixture-never-log');
    }
  });
  it('이미 분류된 오류를 다시 감싸서 정보를 잃지 않음', () => {
    const original = new ApiError('denied', 403, 'FORBIDDEN');
    expect(() => new TestService().fail(original)).toThrow(original);
  });
});
