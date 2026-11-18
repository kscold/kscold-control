import { In } from 'typeorm';
import { TypeOrmBackupRunRepository } from '@/backup/infrastructure/repositories/typeorm-backup-run.repository';

describe('TypeOrmBackupRunRepository', () => {
  beforeEach(() => {
    vi.useFakeTimers().setSystemTime(new Date('2026-10-06T06:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('실행을 시작하면 실행 중 상태의 기록을 만든다', async () => {
    const ormRepository = {
      create: vi.fn((value) => value),
      save: vi.fn((value) => Promise.resolve({ id: 'run-1', ...value })),
    };
    const repository = new TypeOrmBackupRunRepository(ormRepository as never);

    const run = await repository.start({
      targetId: 'target-1',
      trigger: 'manual',
      actor: { id: 'user-1', email: 'admin@example.com' },
    });

    expect(run).toMatchObject({
      id: 'run-1',
      targetId: 'target-1',
      trigger: 'manual',
      status: 'running',
      actorId: 'user-1',
      actorEmail: 'admin@example.com',
      startedAt: new Date('2026-10-06T06:00:00.000Z'),
      finishedAt: null,
      pruned: [],
    });
  });

  it('예약 실행은 요청한 사용자를 비워 둔다', async () => {
    const ormRepository = {
      create: vi.fn((value) => value),
      save: vi.fn((value) => Promise.resolve(value)),
    };
    const repository = new TypeOrmBackupRunRepository(ormRepository as never);

    const run = await repository.start({
      targetId: 'target-1',
      trigger: 'schedule',
      actor: null,
    });

    expect(run).toMatchObject({ actorId: null, actorEmail: null });
  });

  it('실행 결과를 채우면서 끝난 시각을 남긴다', async () => {
    const ormRepository = {
      update: vi.fn().mockResolvedValue({ affected: 1 }),
      findOneOrFail: vi.fn().mockResolvedValue({ id: 'run-1' }),
    };
    const repository = new TypeOrmBackupRunRepository(ormRepository as never);
    const outcome = {
      status: 'success' as const,
      message: '백업을 완료했습니다.',
      archivePath: '/b',
      archiveSizeBytes: 10,
      pruned: [],
    };

    await repository.finish('run-1', outcome);

    expect(ormRepository.update).toHaveBeenCalledWith(
      { id: 'run-1' },
      { ...outcome, finishedAt: new Date('2026-10-06T06:00:00.000Z') },
    );
  });

  it('대상별 가장 최근 실행을 대상 id 로 묶어 돌려준다', async () => {
    const builder = {
      distinctOn: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      addOrderBy: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue([
        { id: 'run-a', targetId: 'target-1' },
        { id: 'run-b', targetId: 'target-2' },
      ]),
    };
    const repository = new TypeOrmBackupRunRepository({
      createQueryBuilder: vi.fn().mockReturnValue(builder),
    } as never);

    const latest = await repository.findLatestByTargetIds([
      'target-1',
      'target-2',
    ]);

    expect(builder.distinctOn).toHaveBeenCalledWith(['run.targetId']);
    expect(builder.addOrderBy).toHaveBeenCalledWith('run.startedAt', 'DESC');
    expect(latest.get('target-1')).toMatchObject({ id: 'run-a' });
    expect(latest.get('target-2')).toMatchObject({ id: 'run-b' });
  });

  it('대상이 없으면 조회하지 않는다', async () => {
    const createQueryBuilder = vi.fn();
    const repository = new TypeOrmBackupRunRepository({
      createQueryBuilder,
    } as never);

    await expect(repository.findLatestByTargetIds([])).resolves.toEqual(
      new Map(),
    );
    expect(createQueryBuilder).not.toHaveBeenCalled();
  });

  it('이력은 최근 실행부터 대상과 함께 조회한다', async () => {
    const find = vi.fn().mockResolvedValue([]);
    const repository = new TypeOrmBackupRunRepository({ find } as never);

    await repository.findRecent({ limit: 30 });
    await repository.findRecent({ targetId: 'target-1', limit: 5 });

    expect(find).toHaveBeenNthCalledWith(1, {
      where: {},
      relations: { target: true },
      order: { startedAt: 'DESC' },
      take: 30,
    });
    expect(find).toHaveBeenNthCalledWith(2, {
      where: { targetId: 'target-1' },
      relations: { target: true },
      order: { startedAt: 'DESC' },
      take: 5,
    });
  });

  it('여러 대상을 지정하면 그 대상들의 이력만 조회한다', async () => {
    const find = vi.fn().mockResolvedValue([]);
    const repository = new TypeOrmBackupRunRepository({ find } as never);

    await repository.findRecent({
      targetIds: ['target-1', 'target-3'],
      limit: 30,
    });

    expect(find).toHaveBeenCalledWith({
      where: { targetId: In(['target-1', 'target-3']) },
      relations: { target: true },
      order: { startedAt: 'DESC' },
      take: 30,
    });
  });

  it('끝나지 못한 실행을 실패로 닫고 닫은 개수를 돌려준다', async () => {
    const update = vi.fn().mockResolvedValue({ affected: 2 });
    const repository = new TypeOrmBackupRunRepository({ update } as never);

    await expect(repository.failUnfinished('중단됨')).resolves.toBe(2);
    expect(update).toHaveBeenCalledWith(
      { status: 'running' },
      {
        status: 'failed',
        message: '중단됨',
        finishedAt: new Date('2026-10-06T06:00:00.000Z'),
      },
    );
  });
});
