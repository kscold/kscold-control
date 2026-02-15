import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../domain/repositories/user.repository.interface';
import {
  IRoleRepository,
  ROLE_REPOSITORY,
} from '../../domain/repositories/role.repository.interface';
import { AssignRolesDto } from '../dto/assign-roles.dto';
import { UserResponseDto } from '../dto/user-response.dto';

/**
 * Assign Roles Use Case
 * Business logic for assigning roles to users
 */
@Injectable()
export class AssignRolesUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: IRoleRepository,
  ) {}

  async execute(dto: AssignRolesDto): Promise<UserResponseDto> {
    // Find user
    const user = await this.userRepository.findByIdWithRoles(dto.userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Find roles
    const roles = await this.roleRepository.findByIds(dto.roleIds);
    user.roles = roles;

    // If guest role is assigned, set terminal limit to 10
    const hasGuestRole = roles.some((role) => role.name === 'guest');
    if (hasGuestRole && user.terminalCommandLimit === -1) {
      user.terminalCommandLimit = 10;
      user.terminalCommandCount = 0;
    }

    const updatedUser = await this.userRepository.save(user);

    return UserResponseDto.fromEntity(updatedUser, true);
  }
}
