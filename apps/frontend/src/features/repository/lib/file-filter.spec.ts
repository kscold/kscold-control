import { filterFiles, getExcludeReason } from './file-filter';

describe('repository file filter', () => {
  it.each([
    '.env',
    '.ENV',
    '.env.production',
    'config/service-account.json',
    'cert/private.pem',
    'home/id_rsa',
    'infra/terraform.tfstate.backup',
    'oauth/client-secret-production.json',
  ])('민감 설정 파일도 업로드 목록에 보존한다: %s', (relativePath) => {
    expect(getExcludeReason(relativePath, 10)).toBeNull();
  });

  it.each(['.ssh/custom-key', '.aws/credentials', '.kube/config'])(
    '자격증명 디렉터리도 업로드 목록에 보존한다: %s',
    (relativePath) => {
      expect(getExcludeReason(relativePath, 10)).toBeNull();
    },
  );

  it.each(['.env.example', '.env.sample', 'src/index.ts'])(
    '공유 가능한 소스 파일은 보존한다: %s',
    (relativePath) => {
      expect(getExcludeReason(relativePath, 10)).toBeNull();
    },
  );

  it('필터 통계에 민감 파일을 보존하고 빌드 캐시는 제외한다', () => {
    const result = filterFiles([
      { relativePath: '.env', file: { size: 10 } },
      { relativePath: 'src/index.ts', file: { size: 20 } },
      { relativePath: 'node_modules/cache.js', file: { size: 30 } },
    ]);

    expect(result.kept).toHaveLength(2);
    expect(result.stats).toMatchObject({ kept: 2, filtered: 1, totalSize: 30 });
  });
});
