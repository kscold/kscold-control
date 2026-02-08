import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.get<string[]>(
      'permissions',
      context.getHandler(),
    );

    if (!requiredPermissions) {
      return true; // 권한 체크 불필요
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user; // JWT에서 추출된 user

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // user.permissions에 필요한 권한이 모두 있는지 확인
    const userPermissions = user.permissions || [];
    const hasAllPermissions = requiredPermissions.every((permission) =>
      userPermissions.includes(permission),
    );

    if (!hasAllPermissions) {
      const missingPermissions = requiredPermissions.filter(
        (permission) => !userPermissions.includes(permission),
      );
      throw new ForbiddenException(
        `Missing permissions: ${missingPermissions.join(', ')}`,
      );
    }

    return true;
  }
}
