import { HttpStatus } from '@nestjs/common';
import { AUDIT_KEY, type AuditMeta } from '@/common/decorators';
import { PERMISSIONS } from '@/common/constants/permissions';
import { BackupController } from '@/backup/presentation/controllers/backup.controller';
import type { BackupRun } from '@/backup/domain/entities/backup-run.entity';
import type { BackupTarget } from '@/backup/domain/entities/backup-target.entity';

describe('BackupController', () => {
  const target = {
    id: '0f8fad5b-d9cb-469f-a165-70867728950e',
    name: 'app-prod',
    description: '운영 DB',
    engine: 'mongodb',
    encryptedUri: 'cipher',
    uriIv: 'iv',
    uriAuthTag: 'tag',
    connectionSummary: 'mongodb+srv://cluster.example.net/prod',
    dumpImage: 'mongo:7',
    retentionDays: 10,
    scheduleTime: '03:30',
    enabled: true,
    scheduleCursorAt: new Date('2026-10-05T18:30:00.000Z'),
    createdBy: 'user-1',
    createdAt: new Date('2026-10-06T05:00:00.000Z'),
    updatedAt: new Date('2026-10-06T05:10:00.000Z'),
  } as BackupTarget;
  const run = {
    id: 'run-1',
    targetId: target.id,
    target,
    trigger: 'manual',
    status: 'success',
    message: '백업을 완료했습니다.',
    archivePath: '/backups/app-prod/2026-10-05_18-30-02',
    archiveSizeBytes: 204800,
    pruned: [],
    actorId: 'user-1',
    actorEmail: 'admin@example.com',
    startedAt: new Date('2026-10-05T18:30:00.000Z'),
    finishedAt: new Date('2026-10-05T18:30:04.000Z'),
  } as BackupRun;
  const request = { user: { id: 'user-1', email: 'admin@example.com' } };

  const getBackupOverview = { execute: jest.fn() };
  const createBackupTarget = { execute: jest.fn() };
  const updateBackupTarget = { execute: jest.fn() };
  const deleteBackupTarget = { execute: jest.fn() };
  const runBackupTarget = { execute: jest.fn() };
  const listBackupRuns = { execute: jest.fn() };

  const controller = new BackupController(
    getBackupOverview as never,
    createBackupTarget as never,
    updateBackupTarget as never,
    deleteBackupTarget as never,
    runBackupTarget as never,
    listBackupRuns as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('조회는 읽기 권한을, 변경과 실행은 관리 권한을 요구한다', () => {
    const permissionsOf = (handler: unknown) =>
      Reflect.getMetadata('permissions', handler as object);

    expect(permissionsOf(controller.listTargets)).toEqual([
      PERMISSIONS.BACKUP_READ,
    ]);
    expect(permissionsOf(controller.listRuns)).toEqual([
      PERMISSIONS.BACKUP_READ,
    ]);
    for (const handler of [
      controller.createTarget,
      controller.updateTarget,
      controller.removeTarget,
      controller.runTarget,
    ]) {
      expect(permissionsOf(handler)).toEqual([PERMISSIONS.BACKUP_MANAGE]);
    }
  });

  it('변경과 실행은 모두 백업 도메인 감사 로그를 남긴다', () => {
    const actions = [
      controller.createTarget,
      controller.updateTarget,
      controller.removeTarget,
      controller.runTarget,
    ].map((handler) => {
      const meta = Reflect.getMetadata(AUDIT_KEY, handler) as AuditMeta;
      expect(meta.domain).toBe('backup');
      return meta.action;
    });

    expect(actions).toEqual([
      'target.create',
      'target.update',
      'target.delete',
      'target.run',
    ]);
  });

  it('현황 응답에 암호화한 접속 정보를 싣지 않는다', async () => {
    getBackupOverview.execute.mockResolvedValueOnce({
      timeZone: 'Asia/Seoul',
      items: [
        {
          target,
          running: false,
          nextRunAt: new Date('2026-10-06T18:30:00.000Z'),
          lastRun: run,
          archives: [
            {
              name: '2026-10-05_18-30-02',
              takenAt: new Date('2026-10-05T18:30:02.000Z'),
              path: '/backups/app-prod/2026-10-05_18-30-02',
              sizeBytes: 204800,
            },
          ],
        },
      ],
    });

    const response = await controller.listTargets(request as never);

    // 누가 조회하는지에 따라 보이는 대상이 달라지므로 요청한 사용자를 넘긴다.
    expect(getBackupOverview.execute).toHaveBeenCalledWith(request.user);
    expect(response).toEqual({
      timeZone: 'Asia/Seoul',
      items: [
        {
          id: target.id,
          name: 'app-prod',
          description: '운영 DB',
          engine: 'mongodb',
          connectionSummary: 'mongodb+srv://cluster.example.net/prod',
          dumpImage: 'mongo:7',
          retentionDays: 10,
          scheduleTime: '03:30',
          enabled: true,
          createdAt: '2026-10-06T05:00:00.000Z',
          updatedAt: '2026-10-06T05:10:00.000Z',
          running: false,
          nextRunAt: '2026-10-06T18:30:00.000Z',
          lastRun: {
            id: 'run-1',
            targetId: target.id,
            targetName: 'app-prod',
            trigger: 'manual',
            status: 'success',
            message: '백업을 완료했습니다.',
            archivePath: '/backups/app-prod/2026-10-05_18-30-02',
            archiveSizeBytes: 204800,
            pruned: [],
            actorEmail: 'admin@example.com',
            startedAt: '2026-10-05T18:30:00.000Z',
            finishedAt: '2026-10-05T18:30:04.000Z',
          },
          archives: [
            {
              name: '2026-10-05_18-30-02',
              takenAt: '2026-10-05T18:30:02.000Z',
              path: '/backups/app-prod/2026-10-05_18-30-02',
              sizeBytes: 204800,
            },
          ],
        },
      ],
    });
    expect(JSON.stringify(response)).not.toContain('cipher');
  });

  it('등록은 요청한 사용자를 만든 사람으로 남긴다', async () => {
    createBackupTarget.execute.mockResolvedValueOnce(target);
    const dto = { name: 'app-prod', uri: 'mongodb://db.example.net/app' };

    const response = await controller.createTarget(dto, request as never);

    expect(createBackupTarget.execute).toHaveBeenCalledWith({
      ...dto,
      createdBy: 'user-1',
    });
    expect(response).not.toHaveProperty('encryptedUri');
    expect(response.name).toBe('app-prod');
  });

  it('수정은 바뀐 항목 이름을 감사 로그용으로 넘긴다', async () => {
    updateBackupTarget.execute.mockResolvedValueOnce({
      target,
      changedFields: ['uri', 'retentionDays'],
    });
    const req = { ...request } as { _auditExtra?: unknown };
    const meta = Reflect.getMetadata(
      AUDIT_KEY,
      controller.updateTarget,
    ) as AuditMeta;

    const response = await controller.updateTarget(
      target.id,
      { retentionDays: 10 },
      req as never,
    );

    expect(req._auditExtra).toEqual({
      changedFields: ['uri', 'retentionDays'],
    });
    // 감사 로그에는 접속 URI 값이 아니라 바뀌었다는 사실만 남는다.
    const metadata = meta.metadata?.({
      response,
      extra: req._auditExtra,
    } as never);
    expect(metadata).toMatchObject({
      changedFields: ['uri', 'retentionDays'],
    });
    expect(JSON.stringify(metadata)).not.toContain('mongodb');
  });

  it('삭제하면 지운 대상을 돌려준다', async () => {
    deleteBackupTarget.execute.mockResolvedValueOnce(target);

    await expect(controller.removeTarget(target.id)).resolves.toMatchObject({
      id: target.id,
      name: 'app-prod',
    });
  });

  it('지금 실행은 시작한 기록을 202 로 돌려준다', async () => {
    const started = { ...run, status: 'running', finishedAt: null };
    runBackupTarget.execute.mockResolvedValueOnce(started);

    const response = await controller.runTarget(target.id, request as never);

    expect(runBackupTarget.execute).toHaveBeenCalledWith(target.id, {
      id: 'user-1',
      email: 'admin@example.com',
    });
    expect(response).toMatchObject({ status: 'running', finishedAt: null });
    expect(Reflect.getMetadata('__httpCode__', controller.runTarget)).toBe(
      HttpStatus.ACCEPTED,
    );
  });

  it('이력 조회는 조건을 그대로 넘기고 대상 이름을 붙여 돌려준다', async () => {
    listBackupRuns.execute.mockResolvedValueOnce([run]);
    const query = { targetId: target.id, limit: 5 };

    const response = await controller.listRuns(query, request as never);

    expect(listBackupRuns.execute).toHaveBeenCalledWith(request.user, query);
    expect(response.items[0]).toMatchObject({
      id: 'run-1',
      targetName: 'app-prod',
    });
  });
});
