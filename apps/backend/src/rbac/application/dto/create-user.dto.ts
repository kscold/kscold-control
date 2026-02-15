import {
  IsEmail,
  IsString,
  MinLength,
  IsArray,
  IsOptional,
} from 'class-validator';

/**
 * Create User DTO
 * Application layer DTO for creating users
 */
export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleIds?: string[];
}
