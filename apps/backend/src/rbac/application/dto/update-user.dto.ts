import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

/**
 * Update User DTO
 * Application layer DTO for updating user information
 */
export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}
