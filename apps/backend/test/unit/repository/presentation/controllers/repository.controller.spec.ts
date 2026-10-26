import { HEADERS_METADATA, GUARDS_METADATA } from '@nestjs/common/constants';
import { RepositoryController } from '@/repository/presentation/controllers/repository.controller';
import { DiagnosticJwtGuard } from '@/common/guards/diagnostic-jwt.guard';
import { PermissionsGuard } from '@/common/guards';
import { PERMISSIONS } from '@/common/constants/permissions';
import type { JwtRequest } from '@/common/types/jwt-request.type';

describe('RepositoryController private files', () => {
  it('파일 내용 허용과 별개로 인증 및 읽기 권한 검사는 유지한다', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, RepositoryController)).toEqual([
      DiagnosticJwtGuard,
      PermissionsGuard,
    ]);
    for (const method of [
      'readFile',
      'readFileAtVersion',
      'downloadArchive',
    ] as const) {
      const handler = RepositoryController.prototype[method];
      expect(Reflect.getMetadata('permissions', handler)).toEqual([
        PERMISSIONS.REPOSITORY_READ,
      ]);
      expect(Reflect.getMetadata(HEADERS_METADATA, handler)).toContainEqual({
        name: 'Cache-Control',
        value: 'private, no-store',
      });
    }
  });

  it('일반 사용자의 env 파일 조회에는 프로젝트 소유자 범위를 적용한다', async () => {
    const execute = jest.fn().mockResolvedValue({ content: 'fixture-only' });
    const controller: RepositoryController = Object.assign(
      Object.create(RepositoryController.prototype),
      {
        readFileUseCase: { execute },
      },
    );
    await controller.readFile('project-id', '.env', {
      user: { id: 'owner-id', roles: ['developer'] },
    } as JwtRequest);
    expect(execute).toHaveBeenCalledWith('project-id', '.env', 'owner-id');
  });
});
