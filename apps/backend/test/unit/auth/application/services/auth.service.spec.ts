import { AuthService } from '@/auth/application/services/auth.service';

describe('AuthService', () => {
  it('JWT 검증 시 역할과 권한 relation을 함께 조회한다', async () => {
    const user = { id: 'user-1', roles: [] } as any;
    const userRepository = {
      findByIdWithRoles: jest.fn().mockResolvedValue(user),
    };
    const service = new AuthService(userRepository as any);

    await expect(service.validateUser('user-1')).resolves.toBe(user);
    expect(userRepository.findByIdWithRoles).toHaveBeenCalledWith('user-1');
  });
});
