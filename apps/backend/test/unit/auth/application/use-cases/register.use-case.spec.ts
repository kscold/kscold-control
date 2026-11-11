import { NotFoundException } from '@nestjs/common';
import { ROLES } from '@/common/constants/roles';
import { RegisterUseCase } from '@/auth/application/use-cases/register.use-case';
import { AuthController } from '@/auth/presentation/controllers/auth.controller';

describe('RegisterUseCase', () => {
  const previous = process.env.CONTROL_REGISTRATION_ENABLED;
  afterEach(() => {
    if (previous === undefined) delete process.env.CONTROL_REGISTRATION_ENABLED;
    else process.env.CONTROL_REGISTRATION_ENABLED = previous;
  });

  function setup() {
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
    const unused = null as any;
    const controller = new AuthController(
      useCase,
      unused,
      unused,
      unused,
      unused,
      unused,
    );
    return { pendingRole, userRepository, roleRepository, useCase, controller };
  }

  it('공개 회원가입에서 승인 대기 역할만 부여한다', async () => {
    process.env.CONTROL_REGISTRATION_ENABLED = 'true';
    const { pendingRole, userRepository, roleRepository, useCase } = setup();

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

  it.each([undefined, '', 'false', 'yes'])(
    'CONTROL_REGISTRATION_ENABLED=%p 이면 가입을 404 로 막고 화면에 닫혔다고 알린다',
    async (value) => {
      if (value === undefined) delete process.env.CONTROL_REGISTRATION_ENABLED;
      else process.env.CONTROL_REGISTRATION_ENABLED = value;
      const { userRepository, controller } = setup();

      await expect(
        controller.register({
          email: 'new-user@example.com',
          password: 'strong-password',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(userRepository.save).not.toHaveBeenCalled();
      expect(controller.registration()).toEqual({ enabled: false });
    },
  );

  it('CONTROL_REGISTRATION_ENABLED=true 이면 화면에 가입을 보이게 한다', () => {
    process.env.CONTROL_REGISTRATION_ENABLED = 'true';
    expect(setup().controller.registration()).toEqual({ enabled: true });
  });
});
