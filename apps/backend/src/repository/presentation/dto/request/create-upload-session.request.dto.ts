import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  Equals,
  IsInt,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const SHA256_HEX = /^[a-f0-9]{64}$/;
const MANIFEST_SHA256 = /^sha256:[a-f0-9]{64}$/;

class UploadSessionFileRequestDto {
  @IsString()
  @MaxLength(4096)
  relativePath: string;

  @IsInt()
  @Min(0)
  @Max(50 * 1024 * 1024)
  size: number;

  @IsString()
  @Matches(SHA256_HEX)
  sha256: string;
}

class UploadSessionBatchRequestDto {
  @IsInt()
  @Min(0)
  index: number;

  @IsInt()
  @Min(1)
  @Max(200)
  totalFiles: number;

  @IsInt()
  @Min(0)
  @Max(100 * 1024 * 1024)
  totalBytes: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => UploadSessionFileRequestDto)
  files: UploadSessionFileRequestDto[];
}

export class CreateUploadSessionRequestDto {
  @IsInt()
  @Equals(2)
  protocolVersion: number;

  @IsBoolean()
  replace: boolean;

  @IsInt()
  @Min(1)
  @Max(20_000)
  totalFiles: number;

  @IsInt()
  @Min(0)
  @Max(2 * 1024 * 1024 * 1024)
  totalBytes: number;

  @IsInt()
  @Min(0)
  @Max(1_000_000)
  filteredCount: number;

  @IsString()
  @Matches(MANIFEST_SHA256)
  manifestDigest: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => UploadSessionBatchRequestDto)
  batches: UploadSessionBatchRequestDto[];
}
