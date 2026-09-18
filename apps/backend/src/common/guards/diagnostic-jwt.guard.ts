import {
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class DiagnosticJwtGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(DiagnosticJwtGuard.name);

  handleRequest<TUser = unknown>(
    error: unknown,
    user: TUser,
    info: { name?: string } | undefined,
    context: ExecutionContext,
  ): TUser {
    if (error || !user) {
      const request = context.switchToHttp().getRequest<{
        method: string;
        headers: { authorization?: string };
      }>();
      const reason = !request.headers.authorization
        ? 'missing_token'
        : info?.name === 'TokenExpiredError'
          ? 'expired_token'
          : info?.name === 'JsonWebTokenError'
            ? 'invalid_token'
            : info?.name === 'NotBeforeError'
              ? 'inactive_token'
              : 'user_validation_failed';
      // Never log token values, request bodies, or uploaded file names.
      this.logger.warn(
        `Authentication rejected: ${reason} ${request.method} ${context.getHandler().name}`,
      );
      if (error instanceof Error) throw error;
      throw new UnauthorizedException({
        statusCode: 401,
        message: '인증을 다시 확인해주세요.',
        code: reason,
      });
    }
    return user;
  }
}
