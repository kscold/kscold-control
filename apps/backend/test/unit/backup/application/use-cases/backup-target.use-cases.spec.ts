import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateBackupTargetUseCase,
  DeleteBackupTargetUseCase,
  UpdateBackupTargetUseCase,
} from '@/backup/application/use-cases';
import type { BackupTarget } from '@/backup/domain/entities/backup-target.entity';

describe('백업 대상 관리 유스케이스', () => {
  const uri = 'mongodb+srv://backup:secret-pass@cluster.example.net/prod?w=1';
  const sealed = { encryptedUri: 'cipher', uriIv: 'iv', uriAuthTag: 'tag' };
  const existing = {
    id: 'target-1',
    name: 'app-prod',
    description: '운영 DB',
    connectionSummary: 'mongodb+srv://cluster.example.net/prod',
    dumpImage: 'mongo:7',
    retentionDays: 10,
    scheduleTime: '03:30',
    enabled: true,
  } as BackupTarget;

  const targetRepository = {
    findById: jest.fn(),
    findByName: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
  const secretService = { seal: jest.fn() };
  const runner = { isRunning: jest.fn() };

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-10-06T06:00:00.000Z'));
    secretService.seal.mockReturnValue(sealed);
    targetRepository.findById.mockResolvedValue(existing);
    targetRepository.findByName.mockResolvedValue(null);
    targetRepository.create.mockImplementation((input) =>
      Promise.resolve({ id: 'new-id', ...input }),
    );
    targetRepository.update.mockImplementation((id, changes) =>
      Promise.resolve({ ...existing, ...changes }),
    );
    runner.isRunning.mockReturnValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('등록', () => {
    const useCase = new CreateBackupTargetUseCase(
      targetRepository as never,
      secretService as never,
    );

    it('접속 URI 를 암호화하고 자격증명을 뺀 접속 위치와 함께 저장한다', async () => {
      await useCase.execute({
        name: 'app-prod',
        description: ' 운영 DB ',
        uri,
        retentionDays: 14,
        scheduleTime: '04:00',
        createdBy: 'user-1',
      });

      expect(secretService.seal).toHaveBeenCalledWith('app-prod', uri);
      expect(targetRepository.create).toHaveBeenCalledWith({
        name: 'app-prod',
        description: '운영 DB',
        ...sealed,
        connectionSummary: 'mongodb+srv://cluster.example.net/prod',
        dumpImage: 'mongo:7',
        retentionDays: 14,
        scheduleTime: '04:00',
        enabled: true,
        scheduleCursorAt: new Date('2026-10-06T06:00:00.000Z'),
        createdBy: 'user-1',
      });
    });

    it('지정하지 않은 값은 기본값(보관 10일, 03:30, mongo:7)으로 채운다', async () => {
      await useCase.execute({ name: 'app-prod', uri, createdBy: null });

      expect(targetRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: '',
          retentionDays: 10,
          scheduleTime: '03:30',
          dumpImage: 'mongo:7',
          enabled: true,
        }),
      );
    });

    it('같은 이름이 이미 있으면 거부한다', async () => {
      targetRepository.findByName.mockResolvedValueOnce(existing);

      await expect(
        useCase.execute({ name: 'app-prod', uri, createdBy: null }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(targetRepository.create).not.toHaveBeenCalled();
    });

    it.each([
      ['이름', { name: '../escape' }],
      ['접속 URI', { uri: 'mongodb://user:p@ss@db.example.net/app' }],
      ['보관 기간', { retentionDays: 0 }],
      ['실행 시각', { scheduleTime: '25:00' }],
      ['덤프 이미지', { dumpImage: '--privileged' }],
    ])('%s 형식이 틀리면 저장하지 않는다', async (_label, override) => {
      await expect(
        useCase.execute({
          name: 'app-prod',
          uri,
          createdBy: null,
          ...override,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(targetRepository.create).not.toHaveBeenCalled();
    });

    it('localhost 주소는 저장하지 않고 호스트 별칭을 쓰라고 알려준다', async () => {
      await expect(
        useCase.execute({
          name: 'blog-prod',
          uri: 'mongodb://user:pass@127.0.0.1:27019/blog',
          createdBy: null,
        }),
      ).rejects.toThrow('host.docker.internal:<포트>');
      expect(targetRepository.create).not.toHaveBeenCalled();
    });

    it('URI 형식 오류 메시지에 입력한 URI 를 싣지 않는다', async () => {
      const error = await useCase
        .execute({
          name: 'app-prod',
          uri: 'mongodb://user:p@ss-secret@db.example.net/app',
          createdBy: null,
        })
        .catch((caught: Error) => caught);

      expect((error as Error).message).not.toContain('ss-secret');
    });
  });

  describe('수정', () => {
    const useCase = new UpdateBackupTargetUseCase(
      targetRepository as never,
      secretService as never,
    );

    it('보낸 항목 중 실제로 바뀐 것만 고친다', async () => {
      const result = await useCase.execute('target-1', {
        description: '운영 DB',
        retentionDays: 30,
        enabled: true,
      });

      expect(targetRepository.update).toHaveBeenCalledWith('target-1', {
        retentionDays: 30,
      });
      expect(result.changedFields).toEqual(['retentionDays']);
      expect(secretService.seal).not.toHaveBeenCalled();
    });

    it('접속 URI 를 보내면 다시 암호화하고 접속 위치도 갱신한다', async () => {
      const newUri = 'mongodb://reader:new-pass@db.example.net:27017/app';

      const result = await useCase.execute('target-1', { uri: newUri });

      expect(secretService.seal).toHaveBeenCalledWith('app-prod', newUri);
      expect(targetRepository.update).toHaveBeenCalledWith('target-1', {
        ...sealed,
        connectionSummary: 'mongodb://db.example.net:27017/app',
      });
      expect(result.changedFields).toEqual(['uri']);
    });

    it('접속 URI 를 localhost 주소로 바꾸려 하면 거절한다', async () => {
      await expect(
        useCase.execute('target-1', { uri: 'mongodb://localhost:27017/app' }),
      ).rejects.toThrow('host.docker.internal:<포트>');
      expect(targetRepository.update).not.toHaveBeenCalled();
    });

    it('접속 URI 를 비워 보내면 저장된 값을 그대로 둔다', async () => {
      const result = await useCase.execute('target-1', { uri: '   ' });

      expect(secretService.seal).not.toHaveBeenCalled();
      expect(targetRepository.update).toHaveBeenCalledWith('target-1', {});
      expect(result.changedFields).toEqual([]);
    });

    it('실행 시각을 바꾸면 예약 기준 시각을 지금으로 옮긴다', async () => {
      await useCase.execute('target-1', { scheduleTime: '15:00' });

      expect(targetRepository.update).toHaveBeenCalledWith('target-1', {
        scheduleTime: '15:00',
        scheduleCursorAt: new Date('2026-10-06T06:00:00.000Z'),
      });
    });

    it('꺼 둔 대상을 다시 켜면 예약 기준 시각을 지금으로 옮긴다', async () => {
      targetRepository.findById.mockResolvedValueOnce({
        ...existing,
        enabled: false,
      });

      await useCase.execute('target-1', { enabled: true });

      expect(targetRepository.update).toHaveBeenCalledWith('target-1', {
        enabled: true,
        scheduleCursorAt: new Date('2026-10-06T06:00:00.000Z'),
      });
    });

    it('대상을 끌 때는 예약 기준 시각을 건드리지 않는다', async () => {
      await useCase.execute('target-1', { enabled: false });

      expect(targetRepository.update).toHaveBeenCalledWith('target-1', {
        enabled: false,
      });
    });

    it.each([
      ['접속 URI', { uri: 'postgres://db.example.net/app' }],
      ['보관 기간', { retentionDays: 5000 }],
      ['실행 시각', { scheduleTime: '9:00' }],
      ['덤프 이미지', { dumpImage: 'mongo 7' }],
    ])('%s 형식이 틀리면 고치지 않는다', async (_label, changes) => {
      await expect(useCase.execute('target-1', changes)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(targetRepository.update).not.toHaveBeenCalled();
    });

    it('없는 대상은 거부한다', async () => {
      targetRepository.findById.mockResolvedValueOnce(null);

      await expect(
        useCase.execute('missing', { retentionDays: 5 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('삭제', () => {
    const useCase = new DeleteBackupTargetUseCase(
      targetRepository as never,
      runner as never,
    );

    it('대상을 지우고 지운 대상을 돌려준다', async () => {
      await expect(useCase.execute('target-1')).resolves.toBe(existing);
      expect(targetRepository.remove).toHaveBeenCalledWith('target-1');
    });

    it('백업이 진행 중이면 지우지 않는다', async () => {
      runner.isRunning.mockReturnValueOnce(true);

      await expect(useCase.execute('target-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(targetRepository.remove).not.toHaveBeenCalled();
    });

    it('없는 대상은 거부한다', async () => {
      targetRepository.findById.mockResolvedValueOnce(null);

      await expect(useCase.execute('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
