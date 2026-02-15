import { Role } from '../../domain/entities/role.entity';
import { PermissionResponseDto } from './permission-response.dto';

/**
 * Role Response DTO
 * Application layer DTO for role responses
 * Never expose raw entities to the outside
 */
export class RoleResponseDto {
  id: string;
  name: string;
  description: string | null;
  permissions?: PermissionResponseDto[];
  createdAt: Date;

  /**
   * Factory method to create DTO from entity
   */
  static fromEntity(role: Role, includePermissions = false): RoleResponseDto {
    const dto = new RoleResponseDto();
    dto.id = role.id;
    dto.name = role.name;
    dto.description = role.description;
    dto.createdAt = role.createdAt;

    if (includePermissions && role.permissions) {
      dto.permissions = PermissionResponseDto.fromEntities(role.permissions);
    }

    return dto;
  }

  /**
   * Factory method to create DTOs from entities array
   */
  static fromEntities(
    roles: Role[],
    includePermissions = false,
  ): RoleResponseDto[] {
    return roles.map((r) => RoleResponseDto.fromEntity(r, includePermissions));
  }
}
