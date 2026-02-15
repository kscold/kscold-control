import { IsString, IsOptional, IsArray } from 'class-validator';

/**
 * Update Role DTO
 * Application layer DTO for updating roles
 */
export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionIds?: string[];
}
