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
  ])('민감 파일을 업로드 목록에서 제외한다: %s', (relativePath) => {
    expect(getExcludeReason(relativePath, 10)).toBe('name');
  });

  it.each(['.ssh/custom-key', '.aws/credentials', '.kube/config'])(
    '자격증명 디렉터리를 업로드 목록에서 제외한다: %s',
    (relativePath) => {
      expect(getExcludeReason(relativePath, 10)).toBe('dir');
    },
  );

  it.each(['.env.example', '.env.sample', 'src/index.ts'])(
    '공유 가능한 소스 파일은 보존한다: %s',
    (relativePath) => {
      expect(getExcludeReason(relativePath, 10)).toBeNull();
    },
  );

  it('필터 통계에 민감 파일 제외를 포함한다', () => {
    const result = filterFiles([
      { relativePath: '.env', file: { size: 10 } },
      { relativePath: 'src/index.ts', file: { size: 20 } },
    ]);

    expect(result.kept).toHaveLength(1);
    expect(result.stats).toMatchObject({ kept: 1, filtered: 1, totalSize: 20 });
  });
});
