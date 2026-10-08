import { assertUploadWithinLimits } from './upload-limits';

const limits = {
  maxFiles: 100000,
  maxTotalBytes: 2 * 1024 ** 3,
  maxBatches: 4000,
};

describe('upload preflight', () => {
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
