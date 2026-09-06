import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { KeyManagementTargetAccessService } from '../../../rbac/application/services/key-management-target-access.service';
import type { JwtRequest } from '../../../common/types/jwt-request.type';

@Injectable()
export class KeyManagementTargetAccessGuard implements CanActivate {
  constructor(
    private readonly targetAccess: KeyManagementTargetAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<JwtRequest & { params?: { targetId?: string } }>();
    const targetId = request.params?.targetId;
    if (!targetId) return true;

    await this.targetAccess.assertCanAccess(request.user, targetId);
    return true;
  }
}
