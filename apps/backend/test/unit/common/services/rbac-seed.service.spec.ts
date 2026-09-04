import { PERMISSIONS } from '@/common/constants/permissions';
import { ROLES } from '@/common/constants/roles';
import { RbacSeedService } from '@/rbac/application/services/rbac-seed.service';

describe('RbacSeedService', () => {
  it('관리 역할들을 현재 최소 권한 정책으로 동기화한다', async () => {
    type TestRole = {
      id: string;
      name: string;
      permissions: Array<{ name: string }>;
    };

    const permissions = Object.values(PERMISSIONS).map((name) => ({ name }));
    const superAdminRole: TestRole = {
      id: 'super-admin-role',
      name: ROLES.SUPER_ADMIN,
      permissions: [],
    };
    const adminRole: TestRole = {
      id: 'admin-role',
      name: ROLES.ADMIN,
      permissions: permissions.slice(0, 2),
    };
    const pendingRole: TestRole = {
      id: 'pending-role',
      name: ROLES.PENDING_APPROVAL,
      permissions: [],
    };
    const keyManagerRole: TestRole = {
      id: 'key-manager-role',
      name: ROLES.KEY_MANAGER,
      permissions: [],
    };
    const readOnlyRole: TestRole = {
      id: 'read-only-role',
      name: ROLES.READ_ONLY,
      permissions: [],
    };
    const operatorRole: TestRole = {
      id: 'operator-role',
      name: ROLES.OPERATOR,
      permissions: [],
    };
    const terminalRole: TestRole = {
      id: 'terminal-role',
      name: ROLES.TERMINAL_ONLY,
      permissions: [],
    };
    const guestRole: TestRole = {
      id: 'guest-role',
      name: ROLES.GUEST,
      permissions: [],
    };
    const rolesByName = new Map<string, TestRole>([
      [ROLES.SUPER_ADMIN, superAdminRole],
      [ROLES.ADMIN, adminRole],
      [ROLES.PENDING_APPROVAL, pendingRole],
      [ROLES.KEY_MANAGER, keyManagerRole],
      [ROLES.READ_ONLY, readOnlyRole],
      [ROLES.OPERATOR, operatorRole],
      [ROLES.TERMINAL_ONLY, terminalRole],
      [ROLES.GUEST, guestRole],
    ]);

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
        .mockImplementation(async (name: string) => rolesByName.get(name)),
      findByName: jest
        .fn()
        .mockImplementation(async (name: string) => rolesByName.get(name)),
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
    expect(readOnlyRole.permissions).toHaveLength(5);
    expect(operatorRole.permissions).toHaveLength(6);
    expect(terminalRole.permissions).toHaveLength(1);
    expect(guestRole.permissions).toHaveLength(4);
    expect(
      keyManagerRole.permissions.map((permission) => permission.name),
    ).toEqual(
      expect.arrayContaining([
        PERMISSIONS.DASHBOARD_READ,
        PERMISSIONS.SECRETS_READ,
        PERMISSIONS.SECRETS_REVEAL,
        PERMISSIONS.SECRETS_WRITE,
        PERMISSIONS.SECRETS_DEPLOY,
      ]),
    );
    expect(keyManagerRole.permissions).toHaveLength(5);
    expect(keyManagerRole.permissions).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: PERMISSIONS.SYSTEM_READ }),
        expect.objectContaining({ name: PERMISSIONS.DOCKER_READ }),
      ]),
    );
  });
});
