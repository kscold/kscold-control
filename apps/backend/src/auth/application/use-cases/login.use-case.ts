import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../../rbac/domain/repositories/user.repository.interface';
import { LoginDto } from '../dto';
import {
  AuthSessionService,
  type SessionClient,
} from '../services/auth-session.service';

/** 로그인 */
@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly authSessions: AuthSessionService,
  ) {}

  async execute(dto: LoginDto, client: SessionClient) {
    const { email, password } = dto;

    const user = await this.userRepository.findByEmailWithRoles(email);

    if (!user) {
      throw new UnauthorizedException(
        '이메일 또는 비밀번호가 올바르지 않습니다.',
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
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
