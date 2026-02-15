import { IsArray, IsString } from 'class-validator';

/**
 * Assign Roles Request DTO
 * Presentation layer DTO for HTTP requests
 */
export class AssignRolesRequestDto {
  @IsArray()
  @IsString({ each: true })
  roleIds: string[];
}
