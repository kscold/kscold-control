import { ForbiddenException } from '@nestjs/common';
import { RemoteDesktopController } from '../../../src/remote-desktop/remote-desktop.controller';
import type { RemoteDesktopService } from '../../../src/remote-desktop/remote-desktop.service';
import type { RemoteDesktopTargetsService } from '../../../src/remote-desktop/remote-desktop-targets.service';
import type { JwtRequest } from '../../../src/common/types/jwt-request.type';

describe('원격 대상 깨우기·상태 권한', () => {
  const targets = {
    wake: jest.fn().mockResolvedValue({ sent: true }),
    status: jest.fn().mockResolvedValue({ online: false }),
  };
  const controller = new RemoteDesktopController(
    {} as RemoteDesktopService,
    targets as unknown as RemoteDesktopTargetsService,
  );
  const request = (roles: string[], impersonation?: unknown) =>
    ({ user: { id: 'user-id', roles, impersonation } }) as JwtRequest;

  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['일반 사용자', request(['user'])],
    ['사용자 미리보기 중인 관리자', request(['admin'], { actorId: 'admin' })],
  ])('%s 는 깨우기와 상태 확인을 할 수 없다', (_, req) => {
    expect(() => controller.wake(req, 'second')).toThrow(ForbiddenException);
    expect(() => controller.status(req, 'second')).toThrow(ForbiddenException);
    expect(targets.wake).not.toHaveBeenCalled();
    expect(targets.status).not.toHaveBeenCalled();
  });

  it('관리자는 깨우기와 상태 확인을 할 수 있다', async () => {
    const admin = request(['admin']);
    await expect(controller.wake(admin, 'second')).resolves.toEqual({
      sent: true,
    });
    await expect(controller.status(admin, 'second')).resolves.toEqual({
      online: false,
    });
  });
});
