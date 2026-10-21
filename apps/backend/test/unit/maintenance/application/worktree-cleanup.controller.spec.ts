import { HttpStatus } from '@nestjs/common';
import { AUDIT_KEY, type AuditMeta } from '@/common/decorators';
import { PERMISSIONS } from '@/common/constants/permissions';
import { WorktreeCleanupController } from '@/maintenance/presentation/controllers/worktree-cleanup.controller';

describe('WorktreeCleanupController', () => {
  const none = { execute: jest.fn() };
  const controller = new WorktreeCleanupController(
    none as never,
    none as never,
    {} as never,
    none as never,
    none as never,
  );
  const permissionsOf = (handler: unknown) =>
    Reflect.getMetadata('permissions', handler as object);

  it('조회·미리보기는 시스템 조회, 변경·실행은 시스템 변경 권한을 요구한다', () => {
    for (const handler of [
      controller.listTargets,
      controller.preview,
      controller.runs,
    ]) {
      expect(permissionsOf(handler)).toEqual([PERMISSIONS.SYSTEM_READ]);
    }
    for (const handler of [
      controller.createTarget,
      controller.updateTarget,
      controller.removeTarget,
      controller.run,
    ]) {
      expect(permissionsOf(handler)).toEqual([PERMISSIONS.SYSTEM_WRITE]);
    }
  });

  it('변경과 실행은 유지보수 도메인 감사 로그를 남긴다', () => {
    for (const handler of [
      controller.createTarget,
      controller.updateTarget,
      controller.removeTarget,
      controller.run,
    ]) {
      expect(
        (Reflect.getMetadata(AUDIT_KEY, handler) as AuditMeta).domain,
      ).toBe('maintenance');
    }
  });

  it('지금 실행은 202 로 접수한다', () => {
    expect(Reflect.getMetadata('__httpCode__', controller.run)).toBe(
      HttpStatus.ACCEPTED,
    );
  });
});
