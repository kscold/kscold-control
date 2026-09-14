import { BadRequestException } from '@nestjs/common';
import { assertSafeRepositoryPath } from '@/repository/application/utils/repository-path.util';

describe('assertSafeRepositoryPath', () => {
  it.each([
    '../secret',
    '/etc/passwd',
    'src/../secret',
    'src\\secret',
    '.versions/archive.tar.gz',
    '.upload-staging/session/file',
    '.upload-receipts/session.json',
    '.upload-backups/project',
    '.repository-versions/archive.tar.gz',
  ])('내부 또는 안전하지 않은 경로를 거부한다: %s', (relativePath) => {
    expect(() => assertSafeRepositoryPath(relativePath)).toThrow(
      BadRequestException,
    );
  });

  it.each([
    '.env',
    '.env.production',
    'config/service-account.json',
    'certs/private.key',
    'home/id_ed25519',
    '.ssh/custom-key',
    '.aws/credentials',
    '.kube/config',
    '.config/gcloud/application_default_credentials.json',
    'infra/terraform.tfstate.backup',
    'oauth/client-secret-production.json',
  ])('인증된 저장소의 설정 파일 경로를 허용한다: %s', (relativePath) => {
    expect(() => assertSafeRepositoryPath(relativePath)).not.toThrow();
  });

  it.each([
    'src/index.ts',
    'README.md',
    '한글/파일.txt',
    '.env.example',
    '.env.sample',
  ])('정상 상대 경로를 허용한다: %s', (relativePath) => {
    expect(() => assertSafeRepositoryPath(relativePath)).not.toThrow();
  });
});
