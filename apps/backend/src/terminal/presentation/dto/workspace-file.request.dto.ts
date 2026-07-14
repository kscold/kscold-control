import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

/** 워크스페이스 diff 파일 대상 지정 */
export class WorkspacePathDto {
  @IsString()
  @IsNotEmpty()
  path!: string;
}

/** 워크스페이스 diff 헝크 단위 조작 */
export class WorkspaceHunkDto extends WorkspacePathDto {
  @IsInt()
  @Min(0)
  hunkIndex!: number;
}

/** git 커밋 메시지 */
export class WorkspaceCommitDto {
  @IsString()
  @IsNotEmpty()
  message!: string;
}

/** git 브랜치 이름 */
export class WorkspaceBranchDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}
