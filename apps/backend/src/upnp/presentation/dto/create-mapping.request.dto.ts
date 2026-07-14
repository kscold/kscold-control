import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import type { CreateMappingDto } from '../../domain/types/port-mapping.type';

/** POST /upnp/mappings 요청 본문 — 런타임 검증 포함 */
export class CreateMappingRequestDto implements CreateMappingDto {
  @IsInt()
  @Min(1)
  @Max(65535)
  publicPort!: number;

  @IsInt()
  @Min(1)
  @Max(65535)
  privatePort!: number;

  @IsOptional()
  @IsIn(['TCP', 'UDP'])
  protocol?: 'TCP' | 'UDP';

  @IsOptional()
  @IsString()
  description?: string;
}
