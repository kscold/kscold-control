import { ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { BackupRunnerService } from '@/backup/application/services/backup-runner.service';
import type { BackupRun } from '@/backup/domain/entities/backup-run.entity';
import type { BackupTarget } from '@/backup/domain/entities/backup-target.entity';

describe('BackupRunnerService', () => {
  const target = {
    id: 'target-1',
    name: 'app-prod',
    dumpImage: 'mongo:7',
    retentionDays: 10,
    encryptedUri: 'cipher',
    uriIv: 'iv',
    uriAuthTag: 'tag',
  } as BackupTarget;
  const plainUri = 'mongodb+srv://backup:secret-pass@cluster.example.net/prod';

  const targetRepository = { findByIdWithSecret: jest.fn() };
  const runRepository = {
    start: jest.fn(),
    finish: jest.fn(),
    failUnfinished: jest.fn(),
  };
  const archiveRepository = { create: jest.fn(), prune: jest.fn() };
  const secretService = { open: jest.fn() };
  let service: BackupRunnerService;

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.resetAllMocks();
    // 실패 경로 테스트가 남기는 로그로 테스트 출력이 지저분해지지 않게 한다.
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    targetRepository.findByIdWithSecret.mockResolvedValue(target);
    secretService.open.mockReturnValue(plainUri);
    archiveRepository.prune.mockResolvedValue([]);
    runRepository.start.mockImplementation((input) =>
      Promise.resolve({
        id: 'run-1',
        targetId: input.targetId,
        trigger: input.trigger,
        status: 'running',
      } as BackupRun),
    );
    runRepository.finish.mockImplementation((id, outcome) =>
      Promise.resolve({ id, targetId: target.id, ...outcome } as BackupRun),
    );

    service = new BackupRunnerService(
      targetRepository as never,
      runRepository as never,
      archiveRepository as never,
      secretService as never,
    );
  });

  it('백업이 성공하면 보관 기간이 지난 백업을 정리하고 결과를 기록한다', async () => {
    archiveRepository.create.mockResolvedValueOnce({
      path: '/backups/app-prod/2026-10-06_18-30-00',
      sizeBytes: 204800,
    });
    archiveRepository.prune.mockResolvedValueOnce(['2026-09-20_18-30-00']);

    const run = await service.runToCompletion('target-1', 'schedule');

    expect(archiveRepository.create).toHaveBeenCalledWith({
      name: 'app-prod',
      uri: plainUri,
      image: 'mongo:7',
    });
    expect(archiveRepository.prune).toHaveBeenCalledWith('app-prod', 10);
    expect(runRepository.finish).toHaveBeenCalledWith('run-1', {
      status: 'success',
      message: expect.stringContaining('1개를 정리'),
      archivePath: '/backups/app-prod/2026-10-06_18-30-00',
      archiveSizeBytes: 204800,
      pruned: ['2026-09-20_18-30-00'],
    });
    expect(run.status).toBe('success');
  });

  it('백업이 실패하면 옛 백업을 정리하지 않는다', async () => {
    archiveRepository.create.mockRejectedValueOnce(new Error('인증 실패'));

    const run = await service.runToCompletion('target-1', 'schedule');

    expect(archiveRepository.prune).not.toHaveBeenCalled();
    expect(run).toMatchObject({
      status: 'failed',
      message: '백업 실패: 인증 실패',
      archivePath: null,
      archiveSizeBytes: null,
      pruned: [],
    });
  });

  it('접속 정보를 복호화하지 못하면 덤프를 시작하지 않고 실패로 기록한다', async () => {
    secretService.open.mockImplementationOnce(() => {
      throw new Error('저장된 접속 정보를 복호화하지 못했습니다.');
    });

    const run = await service.runToCompletion('target-1', 'schedule');

    expect(archiveRepository.create).not.toHaveBeenCalled();
    expect(run.status).toBe('failed');
    expect(run.message).toContain('복호화하지 못했습니다');
  });

  it('정리에 실패해도 방금 만든 백업은 성공으로 남긴다', async () => {
    archiveRepository.create.mockResolvedValueOnce({
      path: '/b',
      sizeBytes: 1,
    });
    archiveRepository.prune.mockRejectedValueOnce(new Error('권한 없음'));

    const run = await service.runToCompletion('target-1', 'schedule');

    expect(run.status).toBe('success');
    expect(run.archivePath).toBe('/b');
    expect(run.message).toContain('정리에 실패');
  });

  it('결과 기록에 실패해도 실행 결과를 돌려준다', async () => {
    archiveRepository.create.mockResolvedValueOnce({
      path: '/b',
      sizeBytes: 1,
    });
    runRepository.finish.mockRejectedValueOnce(new Error('DB 연결 끊김'));

    await expect(
      service.runToCompletion('target-1', 'schedule'),
    ).resolves.toMatchObject({ status: 'success', archivePath: '/b' });
    expect(service.isRunning('target-1')).toBe(false);
  });

  it('수동 실행은 덤프를 기다리지 않고 실행 중인 기록을 바로 돌려준다', async () => {
    let finishDump: (value: { path: string; sizeBytes: number }) => void = () =>
      undefined;
    archiveRepository.create.mockReturnValueOnce(
      new Promise((resolve) => {
        finishDump = resolve;
      }),
    );
    const actor = { id: 'user-1', email: 'admin@example.com' };

    const run = await service.start('target-1', 'manual', actor);

    expect(run).toMatchObject({ id: 'run-1', status: 'running' });
    expect(runRepository.start).toHaveBeenCalledWith({
      targetId: 'target-1',
      trigger: 'manual',
      actor,
    });
    expect(service.isRunning('target-1')).toBe(true);
    expect(runRepository.finish).not.toHaveBeenCalled();

    finishDump({ path: '/b', sizeBytes: 1 });
    await new Promise((resolve) => setImmediate(resolve));

    expect(runRepository.finish).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({ status: 'success' }),
    );
    expect(service.isRunning('target-1')).toBe(false);
  });

  it('등록되지 않은 대상은 거부한다', async () => {
    targetRepository.findByIdWithSecret.mockResolvedValueOnce(null);

    await expect(service.start('unknown', 'manual')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(runRepository.start).not.toHaveBeenCalled();
  });

  it('진행 중인 대상을 다시 실행하면 거부하고, 끝난 뒤에는 다시 받는다', async () => {
    let finishFirst: (value: {
      path: string;
      sizeBytes: number;
    }) => void = () => undefined;
    archiveRepository.create.mockReturnValueOnce(
      new Promise((resolve) => {
        finishFirst = resolve;
      }),
    );

    const first = service.runToCompletion('target-1', 'schedule');
    await new Promise((resolve) => setImmediate(resolve));

    await expect(service.start('target-1', 'manual')).rejects.toBeInstanceOf(
      ConflictException,
    );

    finishFirst({ path: '/b', sizeBytes: 1 });
    await first;

    archiveRepository.create.mockResolvedValueOnce({
      path: '/c',
      sizeBytes: 2,
    });
    await expect(
      service.runToCompletion('target-1', 'schedule'),
    ).resolves.toMatchObject({ status: 'success', archivePath: '/c' });
  });

  it('실행 기록을 만들지 못하면 실행 중 표시를 남기지 않는다', async () => {
    runRepository.start.mockRejectedValueOnce(new Error('DB 연결 끊김'));

    await expect(service.start('target-1', 'manual')).rejects.toThrow(
      'DB 연결 끊김',
    );
    expect(service.isRunning('target-1')).toBe(false);
    expect(archiveRepository.create).not.toHaveBeenCalled();
  });

  it('접속 URI 를 로그에 남기지 않는다', async () => {
    archiveRepository.create.mockResolvedValueOnce({
      path: '/b',
      sizeBytes: 1,
    });

    await service.runToCompletion('target-1', 'schedule');

    for (const method of ['log', 'warn', 'error'] as const) {
      expect(Logger.prototype[method]).not.toHaveBeenCalledWith(
        expect.stringContaining('secret-pass'),
      );
    }
  });

  describe('기동 시 정리', () => {
    it('끝나지 못한 실행 기록을 실패로 닫는다', async () => {
      runRepository.failUnfinished.mockResolvedValueOnce(2);

      await service.onModuleInit();

      expect(runRepository.failUnfinished).toHaveBeenCalledWith(
        expect.stringContaining('다시 시작'),
      );
      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        expect.stringContaining('2건'),
      );
    });

    it('닫을 기록이 없으면 조용히 넘어간다', async () => {
      runRepository.failUnfinished.mockResolvedValueOnce(0);

      await service.onModuleInit();

      expect(Logger.prototype.warn).not.toHaveBeenCalled();
    });

    it('정리에 실패해도 기동을 막지 않는다', async () => {
      runRepository.failUnfinished.mockRejectedValueOnce(new Error('DB 없음'));

      await expect(service.onModuleInit()).resolves.toBeUndefined();
    });
  });
});
