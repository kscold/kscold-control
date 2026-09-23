import { IsString, Matches } from 'class-validator';

export class RestoreSecretBackupDto {
  @IsString()
  @Matches(/^(?:\d+|[a-f0-9]{64})$/)
  expectedVersion: string;
}
