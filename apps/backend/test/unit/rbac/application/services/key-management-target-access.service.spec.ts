import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { KeyManagementTargetAccessService } from '@/rbac/application/services/key-management-target-access.service';

describe('KeyManagementTargetAccessService', () => {
  function fixture() {
    const repository = {
      findEnabledTargets: jest.fn().mockResolvedValue([
        {
          id: 'projectalpha-production',
          displayName: 'ProjectAlpha Production',
          environment: 'production',
        },
        {
          id: 'projectbeta-production',
          displayName: 'ProjectBeta Production',
          environment: 'production',
        },
      ]),
      findTargetIdsByUserId: jest
        .fn()
        .mockResolvedValue(['projectalpha-production']),
      findAllAssignments: jest.fn().mockResolvedValue([]),
      replaceForUser: jest.fn().mockResolvedValue(undefined),
    };
    const users = {
      findByIdWithRoles: jest.fn().mockResolvedValue({
        id: 'key-manager-1',
        roles: [{ name: 'key_manager' }],
      }),
    };
    return {
      repository,
      users,
      service: new KeyManagementTargetAccessService(
        repository as any,
        users as any,
      ),
    };
  }

  it('전역 관리자는 별도 매핑 없이 모든 활성 대상을 조회한다', async () => {
    const { service, repository } = fixture();

    await expect(
      service.getAuthorizedTargetIds({ id: 'admin-1', roles: ['admin'] }),
    ).resolves.toEqual(['projectalpha-production', 'projectbeta-production']);
    expect(repository.findTargetIdsByUserId).not.toHaveBeenCalled();
  });

  it('키 관리자는 DB에 배정된 대상만 조회한다', async () => {
    const { service } = fixture();

    await expect(
      service.getAuthorizedTargetIds({
        id: 'key-manager-1',
        roles: ['key_manager'],
      }),
    ).resolves.toEqual(['projectalpha-production']);
  });

  it('배정되지 않은 대상의 직접 호출을 거절한다', async () => {
    const { service } = fixture();

    await expect(
      service.assertCanAccess(
        { id: 'key-manager-1', roles: ['key_manager'] },
        'projectbeta-production',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('전역 관리자에게 제한 매핑을 저장하지 않는다', async () => {
    const { service, users, repository } = fixture();
    users.findByIdWithRoles.mockResolvedValue({
      id: 'admin-1',
      roles: [{ name: 'super_admin' }],
    });

    await expect(
      service.replaceUserTargets(
        'admin-1',
        ['projectalpha-production'],
        'actor-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.replaceForUser).not.toHaveBeenCalled();
  });

  it('키 관리자의 유효한 대상 범위를 중복 없이 원자 교체한다', async () => {
    const { service, repository } = fixture();

    await expect(
      service.replaceUserTargets(
        'key-manager-1',
        [
          'projectbeta-production',
          'projectalpha-production',
          'projectalpha-production',
        ],
        'admin-1',
      ),
    ).resolves.toEqual({
      userId: 'key-manager-1',
      targetIds: ['projectalpha-production', 'projectbeta-production'],
    });
    expect(repository.replaceForUser).toHaveBeenCalledWith(
      'key-manager-1',
      ['projectalpha-production', 'projectbeta-production'],
      'admin-1',
    );
  });

  it('배정 없는 사용자는 어떤 운영 대상에도 접근할 수 없다', async () => {
    const { service, repository } = fixture();
    repository.findTargetIdsByUserId.mockResolvedValue([]);

    await expect(
      service.getAuthorizedTargetIds({
        id: 'key-manager-1',
        roles: ['key_manager'],
      }),
    ).resolves.toEqual([]);
    expect(repository.replaceForUser).not.toHaveBeenCalled();
  });
});
