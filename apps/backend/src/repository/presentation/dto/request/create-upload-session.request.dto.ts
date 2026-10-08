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
import { REPOSITORY_UPLOAD_LIMITS } from '../../../domain/policies/upload-limits.policy';

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
  @Max(REPOSITORY_UPLOAD_LIMITS.maxFiles, {
    message: '업로드 파일 수는 최대 $constraint1개입니다 (선택: $value개).',
  })
  totalFiles: number;

  @IsInt()
  @Min(0)
  @Max(REPOSITORY_UPLOAD_LIMITS.maxTotalBytes, {
    message: '한 번에 업로드할 수 있는 전체 용량은 최대 2 GiB입니다.',
  })
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
  @ArrayMaxSize(REPOSITORY_UPLOAD_LIMITS.maxBatches, {
    message:
      '업로드 배치는 최대 $constraint1개입니다. 폴더를 나누어 올려주세요.',
  })
  @ValidateNested({ each: true })
  @Type(() => UploadSessionBatchRequestDto)
  batches: UploadSessionBatchRequestDto[];
}
