import { IsString, IsOptional, IsArray } from 'class-validator';

/**
 * Create Role DTO
 * Application layer DTO for creating roles
 */
export class CreateRoleDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  permissionIds: string[];
}
