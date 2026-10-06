import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AUDIT_KEY, type AuditMeta } from '@/common/decorators';
import { PERMISSIONS } from '@/common/constants/permissions';
import { RbacController } from '@/rbac/presentation/controllers/rbac.controller';
import { SetBackupTargetAccessRequestDto } from '@/rbac/presentation/dto';

describe('RBAC 백업 대상 열람 범위 엔드포인트', () => {
  const targetId = '11111111-1111-4111-8111-111111111111';
  const backupTargetAccess = {
    listAccessMatrix: jest.fn(),
    getUserTargetIds: jest.fn(),
    replaceUserTargets: jest.fn(),
  };
  // 이 테스트가 다루지 않는 의존성은 비워 둔다.
  const unused = {} as never;
  const controller = new RbacController(
    unused,
    unused,
    unused,
    unused,
    unused,
    unused,
    unused,
    unused,
    unused,
    unused,
    backupTargetAccess as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('조회와 변경 모두 RBAC 관리 권한을 요구한다', () => {
    for (const handler of [
      controller.getBackupTargetAccess,
      controller.setBackupTargetAccess,
    ]) {
      expect(Reflect.getMetadata('permissions', handler)).toEqual([
        PERMISSIONS.RBAC_MANAGE,
      ]);
    }
  });

  it('배정 현황을 그대로 돌려준다', async () => {
    const matrix = { targets: [], assignments: [] };
    backupTargetAccess.listAccessMatrix.mockResolvedValueOnce(matrix);

    await expect(controller.getBackupTargetAccess()).resolves.toBe(matrix);
  });

  it('범위를 바꾸면서 바꾸기 전 범위를 감사 로그용으로 남긴다', async () => {
    backupTargetAccess.getUserTargetIds.mockResolvedValueOnce([]);
    backupTargetAccess.replaceUserTargets.mockResolvedValueOnce({
      userId: 'user-1',
      targetIds: [targetId],
    });
    const req = { user: { id: 'admin-1' } } as { _auditExtra?: unknown };

    const response = await controller.setBackupTargetAccess(
      'user-1',
      { targetIds: [targetId] },
      req as never,
    );

    expect(backupTargetAccess.replaceUserTargets).toHaveBeenCalledWith(
      'user-1',
      [targetId],
      'admin-1',
    );
    const meta = Reflect.getMetadata(
      AUDIT_KEY,
      controller.setBackupTargetAccess,
    ) as AuditMeta;
    expect(meta).toMatchObject({
      domain: 'rbac',
      action: 'user.set-backup-target-access',
    });
    expect(
      meta.metadata?.({ response, extra: req._auditExtra } as never),
    ).toEqual({ before: [], after: [targetId] });
  });

  describe('요청 본문', () => {
    const errorsOf = async (payload: Record<string, unknown>) =>
      (
        await validate(
          plainToInstance(SetBackupTargetAccessRequestDto, payload),
          { whitelist: true, forbidNonWhitelisted: true },
        )
      ).map((error) => error.property);

    it('UUID 목록과 빈 목록을 받는다', async () => {
      await expect(errorsOf({ targetIds: [targetId] })).resolves.toEqual([]);
      await expect(errorsOf({ targetIds: [] })).resolves.toEqual([]);
    });

    it.each([
      ['UUID 가 아닌 값', { targetIds: ['pawpong-prod'] }],
      ['중복', { targetIds: [targetId, targetId] }],
      ['배열이 아님', { targetIds: targetId }],
      ['누락', {}],
    ])('%s 은 거부한다', async (_label, payload) => {
      await expect(errorsOf(payload)).resolves.toEqual(['targetIds']);
    });
  });
});
