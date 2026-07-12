import { AuthService } from '../auth.service';
import { ROLES } from '../../../../common/constants/roles';

describe('AuthService', () => {
  it('공개 회원가입에서 요청 role을 무시하고 read_only를 부여한다', async () => {
    const readOnlyRole = { name: ROLES.READ_ONLY } as any;
    const userRepository = {
      create: jest.fn((data) => ({ ...data, id: 'user-1' })),
      save: jest.fn((user) => Promise.resolve(user)),
      findByEmailWithRelations: jest.fn(),
    };
    const roleRepository = {
      findByName: jest.fn().mockResolvedValue(readOnlyRole),
      create: jest.fn(),
      save: jest.fn(),
    };
    const jwtService = { sign: jest.fn() };
    const service = new AuthService(
      userRepository as any,
      roleRepository as any,
      jwtService as any,
    );

    await service.register({
      email: 'new-user@example.com',
      password: 'strong-password',
    });

    expect(roleRepository.findByName).toHaveBeenCalledWith(ROLES.READ_ONLY);
    expect(roleRepository.findByName).not.toHaveBeenCalledWith(
      ROLES.SUPER_ADMIN,
    );
    expect(userRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ roles: [readOnlyRole] }),
    );
  });
});
