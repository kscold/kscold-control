import { IsString, Matches, MaxLength } from 'class-validator';

export class PatchEnvironmentKeyDto {
  @IsString()
  @MaxLength(16384)
  secretValue: string;

  @IsString()
  @Matches(/^\d+$/)
  expectedVersion: string;
}
