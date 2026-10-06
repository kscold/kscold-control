import { ArrayMaxSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class SetBackupTargetAccessRequestDto {
  /** 이 사용자가 볼 수 있게 할 백업 대상 id. 빈 배열이면 전부 거둔다. */
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  targetIds: string[];
}
