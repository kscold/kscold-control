import { User } from '../../domain/entities/user.entity';
import { RoleResponseDto } from './role-response.dto';

/**
 * User Response DTO
 * Application layer DTO for user responses
 * Never expose raw entities or passwords to the outside
 */
export class UserResponseDto {
  id: string;
  email: string;
  roles?: RoleResponseDto[];
  terminalCommandCount: number;
  terminalCommandLimit: number;
  createdAt: Date;
  updatedAt: Date;

  /**
   * Factory method to create DTO from entity
   * IMPORTANT: Never include password in response
   */
  static fromEntity(user: User, includeRoles = false): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.email = user.email;
    dto.terminalCommandCount = user.terminalCommandCount;
    dto.terminalCommandLimit = user.terminalCommandLimit;
    dto.createdAt = user.createdAt;
    dto.updatedAt = user.updatedAt;

    if (includeRoles && user.roles) {
      dto.roles = RoleResponseDto.fromEntities(user.roles, true);
    }

    return dto;
  }

  /**
   * Factory method to create DTOs from entities array
   */
  static fromEntities(users: User[], includeRoles = false): UserResponseDto[] {
    return users.map((u) => UserResponseDto.fromEntity(u, includeRoles));
  }
}
