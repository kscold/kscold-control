import { Permission } from '../../domain/entities/permission.entity';

/**
 * Permission Response DTO
 * Application layer DTO for permission responses
 * Never expose raw entities to the outside
 */
export class PermissionResponseDto {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;

  /**
   * Factory method to create DTO from entity
   */
  static fromEntity(permission: Permission): PermissionResponseDto {
    const dto = new PermissionResponseDto();
    dto.id = permission.id;
    dto.name = permission.name;
    dto.description = permission.description;
    dto.createdAt = permission.createdAt;
    return dto;
  }

  /**
   * Factory method to create DTOs from entities array
   */
  static fromEntities(permissions: Permission[]): PermissionResponseDto[] {
    return permissions.map((p) => PermissionResponseDto.fromEntity(p));
  }
}
