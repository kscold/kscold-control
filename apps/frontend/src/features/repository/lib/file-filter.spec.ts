import { chunkFiles, filterFiles, getExcludeReason } from './file-filter';

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
    expect(getExcludeReason(relativePath)).toBeNull();
  });

  it.each(['.ssh/custom-key', '.aws/credentials', '.kube/config'])(
    '자격증명 디렉터리도 업로드 목록에 보존한다: %s',
    (relativePath) => {
      expect(getExcludeReason(relativePath)).toBeNull();
    },
  );

  it.each(['.env.example', '.env.sample', 'src/index.ts'])(
    '공유 가능한 소스 파일은 보존한다: %s',
    (relativePath) => {
      expect(getExcludeReason(relativePath)).toBeNull();
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

  it.each([
    'public/logo.svg',
    'public/logo.svgz',
    'public/image.png',
    'public/photo.JPG',
    'public/icon.ico',
    'public/font.woff2',
    'docs/manual.pdf',
    'assets/fixture.zip',
    'data/fixture.sqlite',
    'model/weights.bin',
    'lib/vendor.jar',
    'vendor/editor.min.js',
    'vendor/editor.min.css',
    'yarn.lock',
    'poetry.lock',
    'Cargo.lock',
    '.vscode/settings.json',
    '.idea/workspace.xml',
    '.settings/org.eclipse.core.resources.prefs',
    '.classpath',
    '.project',
    '.claude/settings.local.json',
    '.serena/project.yml',
    'env/production.env',
    'bin/start.sh',
    '__snapshots__/view.snap',
    'logs/fixture.log',
    'temp/fixture.tmp',
  ])('프로젝트 자산·설정·잠금 파일을 원본으로 보존한다: %s', (relativePath) => {
    expect(getExcludeReason(relativePath)).toBeNull();
  });

  it.each([
    'node_modules/package/index.js',
    '.git/config',
    '.git',
    '.next/cache/data',
    'apps/web/dist/bundle.js',
    'backend/build/classes/main.class',
    'backend/target/app.jar',
    'backend/__pycache__/main.pyc',
    '.venv/lib/module.py',
    '.turbo/cache/file',
    '.gradle/cache/file',
    '.pnpm-store/cache/file',
    'tsconfig.tsbuildinfo',
    'src/cache.pyc',
    '.DS_Store',
    'assets/Thumbs.db',
    'assets/Desktop.ini',
  ])('재생성 가능한 산출물과 메타데이터만 제외한다: %s', (relativePath) => {
    expect(getExcludeReason(relativePath)).not.toBeNull();
  });

  it('1MiB를 넘는 파일도 빼지 않고 용량 제한은 별도 사전 검사에 맡긴다', () => {
    const files = [
      { relativePath: '.env.production', file: { size: 2 * 1024 ** 2 } },
      { relativePath: 'public/logo.svg', file: { size: 50 * 1024 ** 2 } },
      { relativePath: 'data/backup.zip', file: { size: 51 * 1024 ** 2 } },
    ];
    const result = filterFiles(files);
    expect(result.kept).toEqual(files);
    expect(result.stats.filtered).toBe(0);
    expect(result.stats.totalSize).toBe(103 * 1024 ** 2);
  });

  it('중첩 프로젝트 캐시도 제외 폴더 통계에 표시한다', () => {
    const result = filterFiles([
      { relativePath: 'frontend/web/node_modules/a.js', file: { size: 10 } },
      { relativePath: 'backend\\__pycache__\\main.pyc', file: { size: 20 } },
    ]);
    expect([...result.stats.filteredDirs]).toEqual([
      'node_modules',
      '__pycache__',
    ]);
  });

  it('권장 배치 크기보다 큰 자산은 누락 없이 단독 배치로 전송한다', () => {
    const files = [
      { file: { size: 10 } },
      { file: { size: 50 * 1024 ** 2 } },
      { file: { size: 20 } },
    ];
    expect(chunkFiles(files)).toEqual(files.map((file) => [file]));
  });
});
