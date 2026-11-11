import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../../rbac/domain/repositories/user.repository.interface';
import { PasswordHasher } from '../../../common/utils/password-hasher.util';
import { LoginGuardService } from '../../../security/application/services/login-guard.service';
import { LoginDto } from '../dto';
import {
  AuthSessionService,
  type SessionClient,
} from '../services/auth-session.service';

/** 로그인 */
@Injectable()
export class LoginUseCase {
  // 없는 계정도 같은 비용의 비교를 거쳐 응답 시간으로 계정 유무가 드러나지 않게 한다.
  private readonly unknownAccountHash = PasswordHasher.hash(randomUUID());

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly authSessions: AuthSessionService,
    private readonly loginGuard: LoginGuardService,
  ) {}

  async execute(dto: LoginDto, client: SessionClient) {
    const { email, password } = dto;
    const attempt = await this.loginGuard.admit(client.ip, email);

    const account = await this.userRepository.findByEmail(email);
    // 역할 조회를 비밀번호 비교와 함께 돌린다. 있는 계정만 역할을 더 읽느라 늦어지면 응답 시간으로 계정 유무가 드러난다.
    const [isPasswordValid, withRoles] = await Promise.all([
      PasswordHasher.compare(
        password,
        account?.password ?? (await this.unknownAccountHash),
      ),
      account ? this.userRepository.findByIdWithRoles(account.id) : null,
    ]);
    const user = isPasswordValid ? withRoles : null;
    if (!user) {
      await this.loginGuard.failed(
        attempt,
        account ? 'wrong-password' : 'unknown-account',
      );
      throw new UnauthorizedException(
        '이메일 또는 비밀번호가 올바르지 않습니다.',
      );
    }

    // JWT 토큰 생성
    const payload = {
      sub: user.id,
      email: user.email,
      roles: user.roles.map((r) => r.name),
      permissions: user.roles.flatMap((r) => r.permissions.map((p) => p.name)),
    };

    const session = await this.authSessions.open(user.id, client);
    const accessToken = this.authSessions.signAccessToken(payload, session);
    await this.loginGuard.succeeded(attempt, user);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        roles: user.roles.map((r) => r.name),
        permissions: user.roles.flatMap((r) =>
          r.permissions.map((p) => p.name),
        ),
      },
    };
  }
}
