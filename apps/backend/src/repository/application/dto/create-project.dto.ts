import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9_-]*$/, {
    message: '프로젝트명은 소문자/숫자/하이픈/언더스코어만 사용 가능합니다',
  })
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
