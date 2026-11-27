import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { ChangeSshAllowUsersUseCase } from '@/security/application/use-cases/change-ssh-allow-users.use-case';
import {
  GetSshAllowUsersUseCase,
  sshAllowUsersRevision,
} from '@/security/application/use-cases/get-ssh-allow-users.use-case';

const writer = {
  protectedRule: () => null,
  apply: async () => 'failed' as const,
};

describe('SSH 허용 규칙 조회', () => {
  it('연결된 설정 파일이 없으면 미설정 상태로 알린다', async () => {
    const useCase = new GetSshAllowUsersUseCase({
      ...writer,
      read: async () => null,
    });
    await expect(useCase.execute()).resolves.toEqual({ kind: 'unconfigured' });
  });

  it('설정 파일을 읽지 못하면 빈 규칙으로 응답하지 않는다', async () => {
    const useCase = new GetSshAllowUsersUseCase({
      ...writer,
      read: async () => {
        throw new Error('read failed');
      },
    });
    await expect(useCase.execute()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});

describe('SSH 허용 규칙 변경', () => {
  const protectedRule = 'operator@192.0.2.10';
  const config = `AllowUsers ${protectedRule}\n`;
  const revision = sshAllowUsersRevision(config);
  const change = { kind: 'add', rule: 'operator@198.51.100.10' } as const;

  function setup(result: 'applied' | 'conflict' | 'failed') {
    const apply = vi.fn(async () => result);
    const gateway = {
      read: async () => config,
      protectedRule: () => protectedRule,
      apply,
    };
    const get = new GetSshAllowUsersUseCase(gateway);
    return { apply, get, update: new ChangeSshAllowUsersUseCase(gateway, get) };
  }

  it('조회한 버전에서만 변경 후보를 적용한다', async () => {
    const { get, update, apply } = setup('applied');
    await expect(get.execute()).resolves.toMatchObject({
      revision,
      protectedRule,
    });
    await expect(update.execute(change, 'stale')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(apply).not.toHaveBeenCalled();
    await expect(update.execute(change, revision)).resolves.toEqual({
      changed: true,
    });
    expect(apply).toHaveBeenCalledWith(
      revision,
      `${config}AllowUsers ${change.rule}\n`,
    );
  });

  it('적용 단계에서 생긴 충돌과 실패를 각각 응답한다', async () => {
    await expect(
      setup('conflict').update.execute(change, revision),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      setup('failed').update.execute(change, revision),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
