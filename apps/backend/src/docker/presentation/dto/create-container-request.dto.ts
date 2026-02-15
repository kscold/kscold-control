import {
  IsString,
  IsNumber,
  IsObject,
  IsOptional,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Resource Configuration DTO
 */
export class ResourceConfigDto {
  @IsNumber()
  @Min(0.5)
  @Max(16)
  cpus: number;

  @IsString()
  memory: string;
}

/**
 * Create Container Request DTO
 * Presentation layer DTO for HTTP requests
 */
export class CreateContainerRequestDto {
  @IsString()
  name: string;

  @IsString()
  image: string;

  @IsObject()
  ports: Record<string, number>;

  @ValidateNested()
  @Type(() => ResourceConfigDto)
  resources: ResourceConfigDto;

  @IsOptional()
  @IsObject()
  environment?: Record<string, string>;
}
