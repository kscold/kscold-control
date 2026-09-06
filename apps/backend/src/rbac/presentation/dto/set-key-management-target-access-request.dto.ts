import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsString,
  Matches,
} from 'class-validator';

export class SetKeyManagementTargetAccessRequestDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(/^[a-z0-9][a-z0-9-]{1,79}$/, { each: true })
  targetIds: string[];
}
