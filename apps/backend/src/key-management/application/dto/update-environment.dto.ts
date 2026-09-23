import { IsString, Matches, MaxLength } from 'class-validator';

export class UpdateEnvironmentDto {
  @IsString()
  @MaxLength(131072)
  envFile: string;

  @IsString()
  @Matches(/^(?:\d+|[a-f0-9]{64})$/)
  expectedVersion: string;
}
