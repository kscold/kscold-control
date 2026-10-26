import { describe, it, expect } from 'vitest';
import { ApiError } from '../api/api-error';
import { frontendDiagnostic } from './frontend-diagnostic';

describe('브라우저 진단 개인정보 경계', () => {
  it('메시지·스택·쿼리·해시·파일 경로를 보내지 않음', () => {
    window.history.replaceState(
      null,
      '',
      '/repository?private=fixture-never-send#fixture-never-send',
    );
    const error = new Error('fixture-never-send');
    error.stack = 'fixture-never-send';
    const result = frontendDiagnostic(error, {
      kind: 'upload',
      stage: 'batch',
      batchIndex: 4,
    });
    expect(result).toMatchObject({
      route: '/repository',
      kind: 'upload',
      stage: 'batch',
      batchIndex: 4,
    });
    expect(JSON.stringify(result)).not.toContain('fixture-never-send');
    window.history.replaceState(null, '', '/private/fixture-never-send');
    expect(frontendDiagnostic(error).route).toBe('unknown');
  });

  it.each([
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [409, 'conflict'],
    [413, 'payload-limit'],
    [429, 'rate-limit'],
    [400, 'validation'],
    [503, 'server'],
  ])('HTTP %s를 고정 진단 코드로 분류함', (status, code) => {
    expect(
      frontendDiagnostic(new ApiError('fixture-never-send', status)),
    ).toMatchObject({ httpStatus: status, code });
  });

  it('전송 실패·시간 초과·무결성·파일 읽기 실패를 구별함', () => {
    expect(
      frontendDiagnostic(new ApiError('unknown', undefined, 'ETIMEDOUT')).code,
    ).toBe('timeout');
    expect(
      frontendDiagnostic(new ApiError('unknown', undefined, 'ERR_NETWORK'))
        .code,
    ).toBe('network');
    expect(
      frontendDiagnostic(
        Object.assign(new Error('private'), {
          name: 'RepositoryUploadIntegrityError',
        }),
      ).code,
    ).toBe('integrity');
    expect(
      frontendDiagnostic(new DOMException('private', 'NotReadableError')).code,
    ).toBe('file-access');
    expect(frontendDiagnostic('private-string').code).toBe('unexpected');
  });
});
