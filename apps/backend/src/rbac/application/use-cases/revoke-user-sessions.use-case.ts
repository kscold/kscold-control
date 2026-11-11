import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuthSessionService,
  type SessionActor,
} from '../../../auth/application/services/auth-session.service';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../domain/repositories/user.repository.interface';

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
