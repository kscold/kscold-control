import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { BackupTargetAccessService } from '@/rbac/application/services/backup-target-access.service';

describe('BackupTargetAccessService', () => {
  const pawpong = '11111111-1111-4111-8111-111111111111';
  const blog = '22222222-2222-4222-8222-222222222222';

  const admin = { id: 'admin-1', roles: ['admin'], permissions: [] };
  const manager = {
    id: 'manager-1',
    roles: ['custom'],
    permissions: ['backup:read', 'backup:manage'],
  };
  const viewer = {
    id: 'viewer-1',
    roles: ['key_manager'],
    permissions: ['backup:read'],
  };

  function fixture() {
    const repository = {
      findTargets: jest.fn().mockResolvedValue([
        { id: blog, name: 'kscold-blog', description: '' },
        { id: pawpong, name: 'pawpong-prod', description: '' },
      ]),
      findTargetIdsByUserId: jest.fn().mockResolvedValue([pawpong]),
      findAllAssignments: jest
        .fn()
        .mockResolvedValue([{ userId: 'viewer-1', targetIds: [pawpong] }]),
      replaceForUser: jest.fn().mockResolvedValue(undefined),
    };
    const users = {
      // 키 관리자 역할: 백업은 조회 권한만 있다
      findByIdWithRoles: jest.fn().mockResolvedValue({
        id: 'viewer-1',
        roles: [
          { name: 'key_manager', permissions: [{ name: 'backup:read' }] },
        ],
      }),
    };
    return {
      repository,
      users,
      service: new BackupTargetAccessService(
        repository as never,
        users as never,
      ),
    };
  }

  describe('열람 범위', () => {
    it('전역 관리자는 배정 없이 전체를 본다', async () => {
      const { service, repository } = fixture();

      await expect(service.resolveVisibleTargetIds(admin)).resolves.toBeNull();
      expect(repository.findTargetIdsByUserId).not.toHaveBeenCalled();
    });

    it('백업 관리 권한이 있으면 전역 관리자가 아니어도 전체를 본다', async () => {
      const { service } = fixture();

      await expect(
        service.resolveVisibleTargetIds(manager),
      ).resolves.toBeNull();
    });

    it('조회 권한만 있으면 배정받은 대상만 본다', async () => {
      const { service, repository } = fixture();

      await expect(service.resolveVisibleTargetIds(viewer)).resolves.toEqual(
        new Set([pawpong]),
      );
      expect(repository.findTargetIdsByUserId).toHaveBeenCalledWith('viewer-1');
    });

    it('배정이 없으면 아무 대상도 보지 못한다', async () => {
      const { service, repository } = fixture();
      repository.findTargetIdsByUserId.mockResolvedValueOnce([]);

      await expect(service.resolveVisibleTargetIds(viewer)).resolves.toEqual(
        new Set(),
      );
    });

    it('배정받지 않은 대상을 직접 지정하면 거절한다', async () => {
      const { service } = fixture();

      await expect(service.assertCanView(viewer, pawpong)).resolves.toBe(
        undefined,
      );
      await expect(service.assertCanView(viewer, blog)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(service.assertCanView(admin, blog)).resolves.toBe(undefined);
    });
  });

  describe('범위 지정', () => {
    it('대상 목록과 사용자별 배정 현황을 함께 돌려준다', async () => {
      const { service } = fixture();

      await expect(service.listAccessMatrix()).resolves.toEqual({
        targets: [
          { id: blog, name: 'kscold-blog', description: '' },
          { id: pawpong, name: 'pawpong-prod', description: '' },
        ],
        assignments: [{ userId: 'viewer-1', targetIds: [pawpong] }],
      });
    });

    it('사용자의 범위를 통째로 바꾸고 누가 바꿨는지 남긴다', async () => {
      const { service, repository } = fixture();

      await expect(
        service.replaceUserTargets('viewer-1', [pawpong, pawpong], 'admin-1'),
      ).resolves.toEqual({ userId: 'viewer-1', targetIds: [pawpong] });
      expect(repository.replaceForUser).toHaveBeenCalledWith(
        'viewer-1',
        [pawpong],
        'admin-1',
      );
    });

    it('빈 배열이면 배정을 전부 거둔다', async () => {
      const { service, repository } = fixture();

      await service.replaceUserTargets('viewer-1', [], 'admin-1');

      expect(repository.replaceForUser).toHaveBeenCalledWith(
        'viewer-1',
        [],
        'admin-1',
      );
    });

    it('없는 대상은 배정하지 않는다', async () => {
      const { service, repository } = fixture();

      await expect(
        service.replaceUserTargets(
          'viewer-1',
          ['33333333-3333-4333-8333-333333333333'],
          'admin-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.replaceForUser).not.toHaveBeenCalled();
    });

    it('전체를 볼 수 있는 사용자에게는 범위를 정하지 않는다', async () => {
      const { service, users, repository } = fixture();
      users.findByIdWithRoles.mockResolvedValueOnce({
        id: 'admin-1',
        roles: [{ name: 'super_admin', permissions: [] }],
      });

      await expect(
        service.replaceUserTargets('admin-1', [pawpong], 'admin-1'),
      ).rejects.toThrow('모든 백업 대상을 볼 수 있어');
      expect(repository.replaceForUser).not.toHaveBeenCalled();
    });

    it('백업 조회 권한이 없는 사용자에게 대상을 배정하면 이유를 알려준다', async () => {
      const { service, users, repository } = fixture();
      users.findByIdWithRoles.mockResolvedValueOnce({
        id: 'guest-1',
        roles: [{ name: 'guest', permissions: [{ name: 'dashboard:read' }] }],
      });

      await expect(
        service.replaceUserTargets('guest-1', [pawpong], 'admin-1'),
      ).rejects.toThrow('백업 조회 권한이 없습니다');
      expect(repository.replaceForUser).not.toHaveBeenCalled();
    });

    it('조회 권한이 없어도 배정을 거두는 것은 된다', async () => {
      const { service, users, repository } = fixture();
      users.findByIdWithRoles.mockResolvedValueOnce({
        id: 'guest-1',
        roles: [{ name: 'guest', permissions: [] }],
      });

      await service.replaceUserTargets('guest-1', [], 'admin-1');

      expect(repository.replaceForUser).toHaveBeenCalledWith(
        'guest-1',
        [],
        'admin-1',
      );
    });

    it('없는 사용자는 거절한다', async () => {
      const { service, users } = fixture();
      users.findByIdWithRoles.mockResolvedValueOnce(null);

      await expect(
        service.replaceUserTargets('missing', [pawpong], 'admin-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
