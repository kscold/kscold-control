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

/**
 * Update User Use Case
 * Business logic for updating user information
 */
@Injectable()
export class UpdateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(userId: string, dto: UpdateUserDto): Promise<UserResponseDto> {
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
    }

    const updatedUser = await this.userRepository.save(user);

    return UserResponseDto.fromEntity(updatedUser, true);
  }
}
