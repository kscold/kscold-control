import { ROLES } from '@/common/constants/roles';
import { RegisterUseCase } from '@/auth/application/use-cases/register.use-case';

describe('RegisterUseCase', () => {
  it('공개 회원가입에서 승인 대기 역할만 부여한다', async () => {
    const pendingRole = { name: ROLES.PENDING_APPROVAL } as any;
    const userRepository = {
      create: jest.fn((data) => ({ ...data, id: 'user-1' })),
      save: jest.fn((user) => Promise.resolve(user)),
      findByEmail: jest.fn().mockResolvedValue(null),
    };
    const roleRepository = {
      findByName: jest.fn().mockResolvedValue(pendingRole),
      create: jest.fn(),
      save: jest.fn(),
    };
    const useCase = new RegisterUseCase(
      userRepository as any,
      roleRepository as any,
    );

    await useCase.execute({
      email: 'new-user@example.com',
      password: 'strong-password',
    });

    expect(roleRepository.findByName).toHaveBeenCalledWith(
      ROLES.PENDING_APPROVAL,
    );
    expect(roleRepository.findByName).not.toHaveBeenCalledWith(
      ROLES.SUPER_ADMIN,
    );
    expect(userRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ roles: [pendingRole] }),
    );
  });
});
