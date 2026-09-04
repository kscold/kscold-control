import { PERMISSIONS } from '@/common/constants/permissions';
import { ROLES } from '@/common/constants/roles';
import { RbacSeedService } from '@/rbac/application/services/rbac-seed.service';

describe('RbacSeedService', () => {
  it('레거시 admin 역할에도 현재 전체 권한을 동기화한다', async () => {
    const permissions = Object.values(PERMISSIONS).map((name) => ({ name }));
    const superAdminRole = {
      id: 'super-admin-role',
      name: ROLES.SUPER_ADMIN,
      permissions: [],
    };
    const adminRole = {
      id: 'admin-role',
      name: ROLES.ADMIN,
      permissions: permissions.slice(0, 2),
    };
    const pendingRole = {
      id: 'pending-role',
      name: ROLES.PENDING_APPROVAL,
      permissions: [],
    };
    const keyManagerRole = {
      id: 'key-manager-role',
      name: ROLES.KEY_MANAGER,
      permissions: [],
    };

    const permissionRepository = {
      findByName: jest
        .fn()
        .mockImplementation(async (name: string) => ({ name })),
      findAll: jest.fn().mockResolvedValue(permissions),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    };
    const roleRepository = {
      findByNameWithPermissions: jest
        .fn()
        .mockImplementation(async (name: string) => {
          if (name === ROLES.SUPER_ADMIN) return superAdminRole;
          if (name === ROLES.ADMIN) return adminRole;
          if (name === ROLES.PENDING_APPROVAL) return pendingRole;
          if (name === ROLES.KEY_MANAGER) return keyManagerRole;
          return null;
        }),
      findByName: jest.fn().mockImplementation(async (name: string) => {
        if (name === ROLES.SUPER_ADMIN) return superAdminRole;
        return { id: `${name}-role`, name, permissions: [] };
      }),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    };
    const userRepository = {
      findByEmailWithRoles: jest.fn().mockResolvedValue({
        id: 'admin-user',
        roles: [superAdminRole],
      }),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    };
    const service = new RbacSeedService(
      permissionRepository as any,
      roleRepository as any,
      userRepository as any,
    );

    await service.seedInitialData();

    expect(adminRole.permissions).toEqual(permissions);
    expect(roleRepository.save).toHaveBeenCalledWith(adminRole);
  });
});
