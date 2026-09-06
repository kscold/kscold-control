import { ApproveKeyManagerUseCase } from '@/rbac/application/use-cases/approve-key-manager.use-case';
import { ROLES } from '@/common/constants/roles';

describe('ApproveKeyManagerUseCase', () => {
  it('승인 시 키 관리자 역할만 남기고 터미널을 0회로 차단한다', async () => {
    const pendingRole = { id: 'pending', name: ROLES.PENDING_APPROVAL };
    const keyManagerRole = {
      id: 'key-manager',
      name: ROLES.KEY_MANAGER,
      permissions: [],
    };
    const user = {
      id: 'user-1',
      email: 'developer@example.com',
      roles: [pendingRole],
      terminalCommandCount: 7,
      terminalCommandLimit: -1,
    };
    const userRepository = {
      findByIdWithRoles: jest.fn().mockResolvedValue(user),
      save: jest.fn(async (value) => value),
    };
    const roleRepository = {
      findByNameWithPermissions: jest.fn().mockResolvedValue(keyManagerRole),
    };
    const targetAccess = {
      ensureDefaultTarget: jest.fn().mockResolvedValue(undefined),
    };
    const useCase = new ApproveKeyManagerUseCase(
      userRepository as any,
      roleRepository as any,
      targetAccess as any,
    );

    const result = await useCase.execute(user.id, 'admin-1');

    expect(user.roles).toEqual([keyManagerRole]);
    expect(user.terminalCommandCount).toBe(0);
    expect(user.terminalCommandLimit).toBe(0);
    expect(result.terminalCommandLimit).toBe(0);
    expect(userRepository.save).toHaveBeenCalledWith(user);
    expect(targetAccess.ensureDefaultTarget).toHaveBeenCalledWith(
      user.id,
      'admin-1',
    );
  });
});
