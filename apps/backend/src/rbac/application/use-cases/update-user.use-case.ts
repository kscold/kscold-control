import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../domain/repositories/user.repository.interface';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserResponseDto } from '../dto/user-response.dto';
import { PasswordHasher } from '../../../common/utils/password-hasher.util';
import {
  AuthSessionService,
  type SessionActor,
} from '../../../auth/application/services/auth-session.service';

/**
 * Update User Use Case
 * Business logic for updating user information
 */
@Injectable()
export class UpdateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly authSessions: AuthSessionService,
  ) {}

  async execute(
    userId: string,
    dto: UpdateUserDto,
    actor: SessionActor,
  ): Promise<UserResponseDto> {
    // Find user
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Update email if provided
    if (dto.email) {
      const existingUser = await this.userRepository.findByEmail(dto.email);
      if (existingUser && existingUser.id !== userId) {
        throw new ConflictException('Email already exists');
      }
      user.email = dto.email;
    }

    // Update password if provided (using Phase 1 utility)
    if (dto.password) {
      user.password = await PasswordHasher.hash(dto.password);
      // 끊기가 실패하면 비밀번호도 그대로 둔다. 끊은 뒤 저장이 실패하면 세션만 끊긴 채 남아 안전한 쪽으로 멈춘다.
      await this.authSessions.revokeAllForUser(userId, actor);
    }

    const updatedUser = await this.userRepository.save(user);

    return UserResponseDto.fromEntity(updatedUser, true);
  }
}
