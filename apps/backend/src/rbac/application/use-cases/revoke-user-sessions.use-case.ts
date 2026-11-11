import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuthSessionService,
  type SessionActor,
} from '../../../auth/application/services/auth-session.service';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../domain/repositories/user.repository.interface';

/** 관리자가 사용자의 로그인 세션을 모두 끊는다. 자기 계정이면 지금 쓰는 세션은 남는다. */
@Injectable()
export class RevokeUserSessionsUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly authSessions: AuthSessionService,
  ) {}

  async execute(
    userId: string,
    actor: SessionActor,
  ): Promise<{ revoked: number }> {
    if (!(await this.userRepository.findById(userId))) {
      throw new NotFoundException('User not found');
    }
    return {
      revoked: await this.authSessions.revokeAllForUser(userId, actor),
    };
  }
}
