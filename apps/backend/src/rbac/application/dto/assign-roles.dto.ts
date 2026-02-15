import { IsArray, IsString } from 'class-validator';

/**
 * Assign Roles DTO
 * Application layer DTO for assigning roles to users
 */
export class AssignRolesDto {
  @IsString()
  userId: string;

  @IsArray()
  @IsString({ each: true })
  roleIds: string[];
}
