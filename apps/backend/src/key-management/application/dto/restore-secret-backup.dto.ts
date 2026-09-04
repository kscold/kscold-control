import { IsString, Matches } from 'class-validator';

export class RestoreSecretBackupDto {
  @IsString()
  @Matches(/^\d+$/)
  expectedVersion: string;
}
