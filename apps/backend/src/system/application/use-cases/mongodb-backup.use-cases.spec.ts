import { BadRequestException } from '@nestjs/common';
import { BackupMongodbUseCase } from './backup-mongodb.use-case';
import { ListBackupsUseCase } from './list-backups.use-case';

describe('MongoDB backup use cases', () => {
  const repository = {
    create: jest.fn(),
    list: jest.fn(),
  };
  const backupUseCase = new BackupMongodbUseCase(repository);
  const listUseCase = new ListBackupsUseCase(repository);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('유효한 컨테이너의 백업 생성을 포트에 위임한다', async () => {
    const result = { path: '/tmp/backup', size: '10M' };
    repository.create.mockResolvedValueOnce(result);

    await expect(backupUseCase.execute('ubuntu-blog')).resolves.toEqual(result);
    expect(repository.create).toHaveBeenCalledWith('ubuntu-blog');
  });

  it('백업 목록 조회를 포트에 위임한다', async () => {
    const result = [{ date: '2026-07-15', path: '/tmp/backup', size: '10M' }];
    repository.list.mockResolvedValueOnce(result);

    await expect(listUseCase.execute('ubuntu-blog')).resolves.toEqual(result);
    expect(repository.list).toHaveBeenCalledWith('ubuntu-blog');
  });

  it.each([backupUseCase, listUseCase])(
    '잘못된 컨테이너 이름은 포트 호출 전에 거부한다',
    async (useCase) => {
      await expect(useCase.execute('../unsafe')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repository.create).not.toHaveBeenCalled();
      expect(repository.list).not.toHaveBeenCalled();
    },
  );
});
