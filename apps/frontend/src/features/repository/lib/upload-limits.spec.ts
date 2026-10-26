import {
  assertUploadFilesWithinLimits,
  assertUploadWithinLimits,
} from './upload-limits';

const limits = {
  maxFiles: 100000,
  maxTotalBytes: 2 * 1024 ** 3,
  maxBatches: 4000,
};

describe('upload preflight', () => {
  it('서버의 파일당 한도까지 자산을 허용하고 초과 파일의 경로를 안내한다', () => {
    const maxFileBytes = 50 * 1024 ** 2;
    expect(() =>
      assertUploadFilesWithinLimits(
        [{ relativePath: 'public/logo.svg', file: { size: maxFileBytes } }],
        { ...limits, maxFileBytes },
      ),
    ).not.toThrow();
    expect(() =>
      assertUploadFilesWithinLimits(
        [{ relativePath: 'data/backup.zip', file: { size: maxFileBytes + 1 } }],
        { ...limits, maxFileBytes },
      ),
    ).toThrow('data/backup.zip');
  });

  it('구버전 서버에서도 1MiB가 아니라 실제 50MiB 한도를 사용한다', () => {
    expect(() =>
      assertUploadFilesWithinLimits(
        [{ relativePath: '.env', file: { size: 2 * 1024 ** 2 } }],
        limits,
      ),
    ).not.toThrow();
    expect(() =>
      assertUploadFilesWithinLimits(
        [{ relativePath: 'archive.zip', file: { size: 51 * 1024 ** 2 } }],
        limits,
      ),
    ).toThrow('파일을 임의로 제외하지 않았습니다');
  });

  it('운영 요청 규모와 정확한 한도는 허용한다', () => {
    expect(() =>
      assertUploadWithinLimits(26204, 815999047, 543, limits),
    ).not.toThrow();
    expect(() =>
      assertUploadWithinLimits(100000, limits.maxTotalBytes, 4000, limits),
    ).not.toThrow();
  });
  it('서버가 알려준 현재 파일 수, 바이트, 배치 한도를 먼저 검사한다', () => {
    expect(() =>
      assertUploadWithinLimits(26204, 815999047, 543, {
        ...limits,
        maxFiles: 20000,
      }),
    ).toThrow('26,204');
    expect(() =>
      assertUploadWithinLimits(1, limits.maxTotalBytes + 1, 1, limits),
    ).toThrow('용량');
    expect(() => assertUploadWithinLimits(1, 1, 4001, limits)).toThrow('배치');
  });
});
