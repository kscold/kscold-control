import { Injectable, Inject, ConflictException } from '@nestjs/common';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../domain/repositories/user.repository.interface';
import {
  IRoleRepository,
  ROLE_REPOSITORY,
} from '../../domain/repositories/role.repository.interface';
import { Role } from '../../domain/entities/role.entity';
import { CreateUserDto } from '../dto/create-user.dto';
import { UserResponseDto } from '../dto/user-response.dto';
import { PasswordHasher } from '../../../common/utils/password-hasher.util';

/**
 * Create User Use Case
 * Business logic for creating new users
 */
@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: IRoleRepository,
  ) {}

  async execute(dto: CreateUserDto): Promise<UserResponseDto> {
    // Check if email already exists
    const existingUser = await this.userRepository.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Hash password using Phase 1 utility
    const hashedPassword = await PasswordHasher.hash(dto.password);

    // Fetch roles if provided
    let roles: Role[] = [];
    if (dto.roleIds && dto.roleIds.length > 0) {
      roles = await this.roleRepository.findByIds(dto.roleIds);
    }

    // Check if guest role is assigned
    const guestRole = await this.roleRepository.findByName('guest');
    const isGuest = roles.some((role) => role.id === guestRole?.id);

    // Create user with appropriate terminal limit
    const user = this.userRepository.create({
      email: dto.email,
      password: hashedPassword,
      roles,
      terminalCommandCount: 0,
      terminalCommandLimit: isGuest ? 10 : -1, // Guest: 10 commands, Others: unlimited
    });

    const savedUser = await this.userRepository.save(user);

    // Return DTO (never expose password)
    return UserResponseDto.fromEntity(savedUser, true);
  }
}
