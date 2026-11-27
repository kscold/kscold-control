import { ServiceUnavailableException } from '@nestjs/common';
import { GetSshAllowUsersUseCase } from '@/security/application/use-cases/get-ssh-allow-users.use-case';

describe('SSH 허용 규칙 조회', () => {
  it('연결된 설정 파일이 없으면 미설정 상태로 알린다', async () => {
    const useCase = new GetSshAllowUsersUseCase({ read: async () => null });
    await expect(useCase.execute()).resolves.toEqual({ kind: 'unconfigured' });
  });

  it('설정 파일을 읽지 못하면 빈 규칙으로 응답하지 않는다', async () => {
    const useCase = new GetSshAllowUsersUseCase({
      read: async () => {
        throw new Error('read failed');
      },
    });
    await expect(useCase.execute()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
