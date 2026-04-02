import {
  parseDockerReclaimableToBytes,
  parseDockerSizeToBytes,
  parseDockerSystemDfOutput,
} from '../docker-disk-usage.util';

describe('docker-disk-usage.util', () => {
  it('사이즈 문자열을 바이트로 변환한다', () => {
    expect(parseDockerSizeToBytes('43.22GB')).toBeCloseTo(46407121633, -2);
    expect(parseDockerSizeToBytes('418.8MB')).toBeCloseTo(439143629, -2);
    expect(parseDockerSizeToBytes('0B')).toBe(0);
  });

  it('재사용 가능 문자열에서 용량만 추출한다', () => {
    expect(parseDockerReclaimableToBytes('37.82GB (87%)')).toBeCloseTo(40608915784, -2);
    expect(parseDockerReclaimableToBytes('0B (0%)')).toBe(0);
  });

  it('docker system df 출력을 카테고리별로 파싱한다', () => {
    const usage = parseDockerSystemDfOutput(
      [
        '{"Active":"6","Reclaimable":"37.82GB (87%)","Size":"43.22GB","TotalCount":"15","Type":"Images"}',
        '{"Active":"6","Reclaimable":"0B (0%)","Size":"19.71GB","TotalCount":"6","Type":"Containers"}',
        '{"Active":"9","Reclaimable":"418.8MB (21%)","Size":"1.966GB","TotalCount":"14","Type":"Local Volumes"}',
        '{"Active":"0","Reclaimable":"0B","Size":"9.304GB","TotalCount":"50","Type":"Build Cache"}',
      ].join('\n'),
    );

    expect(usage.images.totalCount).toBe(15);
    expect(usage.containers.active).toBe(6);
    expect(usage.volumes.reclaimable).toBeCloseTo(439143629, -2);
    expect(usage.buildCache.size).toBeCloseTo(9990093930, -2);
    expect(usage.total).toBeGreaterThan(usage.images.size);
    expect(usage.reclaimable).toBeGreaterThan(usage.volumes.reclaimable);
  });
});
