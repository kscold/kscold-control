import { TypeOrmBackupTargetRepository } from '@/backup/infrastructure/repositories/typeorm-backup-target.repository';

describe('TypeOrmBackupTargetRepository', () => {
  it('목록은 이름순으로 조회한다', async () => {
    const find = jest.fn().mockResolvedValue([]);
    const repository = new TypeOrmBackupTargetRepository({ find } as never);

    await repository.findAll();

    expect(find).toHaveBeenCalledWith({ order: { name: 'ASC' } });
  });

  it('사용 중인 대상만 조회한다', async () => {
    const find = jest.fn().mockResolvedValue([]);
    const repository = new TypeOrmBackupTargetRepository({ find } as never);

    await repository.findEnabled();

    expect(find).toHaveBeenCalledWith({
      where: { enabled: true },
      order: { name: 'ASC' },
    });
  });

  it('덤프용 조회에서만 암호문 컬럼을 읽는다', async () => {
    const builder = {
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };
    const repository = new TypeOrmBackupTargetRepository({
      createQueryBuilder: jest.fn().mockReturnValue(builder),
    } as never);

    await repository.findByIdWithSecret('target-1');

    expect(builder.addSelect.mock.calls.map(([column]) => column)).toEqual([
      'target.encryptedUri',
      'target.uriIv',
      'target.uriAuthTag',
    ]);
    expect(builder.where).toHaveBeenCalledWith('target.id = :id', {
      id: 'target-1',
    });
  });

  it('등록한 뒤에는 암호문이 빠진 형태로 다시 읽어 돌려준다', async () => {
    const input = { name: 'app-prod', encryptedUri: 'cipher' };
    const stored = { id: 'target-1', name: 'app-prod' };
    const ormRepository = {
      create: jest.fn().mockReturnValue(input),
      save: jest.fn().mockResolvedValue({ id: 'target-1', ...input }),
      findOne: jest.fn().mockResolvedValue(stored),
    };
    const repository = new TypeOrmBackupTargetRepository(
      ormRepository as never,
    );

    await expect(repository.create(input as never)).resolves.toBe(stored);
    expect(ormRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'target-1' },
    });
  });

  it('수정은 넘겨받은 컬럼만 고친다', async () => {
    const ormRepository = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      findOne: jest.fn().mockResolvedValue({ id: 'target-1' }),
    };
    const repository = new TypeOrmBackupTargetRepository(
      ormRepository as never,
    );

    await repository.update('target-1', { retentionDays: 30 });

    expect(ormRepository.update).toHaveBeenCalledWith(
      { id: 'target-1' },
      { retentionDays: 30 },
    );
  });

  it('바뀐 항목이 없으면 쓰지 않고 현재 값을 돌려준다', async () => {
    const ormRepository = {
      update: jest.fn(),
      findOne: jest.fn().mockResolvedValue({ id: 'target-1' }),
    };
    const repository = new TypeOrmBackupTargetRepository(
      ormRepository as never,
    );

    await expect(repository.update('target-1', {})).resolves.toEqual({
      id: 'target-1',
    });
    expect(ormRepository.update).not.toHaveBeenCalled();
  });

  it('예약 기준 시각은 수정 시각을 건드리지 않고 그 컬럼만 옮긴다', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const repository = new TypeOrmBackupTargetRepository({ query } as never);
    const at = new Date('2026-10-05T18:30:00.000Z');

    await repository.moveScheduleCursor('target-1', at);

    const [sql, parameters] = query.mock.calls[0];
    expect(sql).toContain('schedule_cursor_at = $1');
    expect(sql).not.toContain('updated_at');
    expect(parameters).toEqual([at, 'target-1']);
  });

  it('id 로 대상을 지운다', async () => {
    const remove = jest.fn().mockResolvedValue({ affected: 1 });
    const repository = new TypeOrmBackupTargetRepository({
      delete: remove,
    } as never);

    await repository.remove('target-1');

    expect(remove).toHaveBeenCalledWith({ id: 'target-1' });
  });
});
