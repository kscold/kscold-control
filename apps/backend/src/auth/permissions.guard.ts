import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private authService: AuthService,
  ) {}

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

    // 모든 필요 권한 확인
    for (const permission of requiredPermissions) {
      const hasPermission = await this.authService.hasPermission(
        user.sub,
        permission,
      );
      if (!hasPermission) {
        throw new ForbiddenException(`Missing permission: ${permission}`);
      }
    }

    return true;
  }
}

// 데코레이터
export const RequirePermissions = (...permissions: string[]) =>
  Reflect.metadata('permissions', permissions);
