import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import type { MfaMethod } from '../mfa.service';

export class MfaCodeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  code: string;
}

export class CompleteMfaEnrollmentDto extends MfaCodeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  challenge: string;
}

export class VerifyMfaDto extends CompleteMfaEnrollmentDto {
  @IsIn(['totp', 'recovery'])
  method: MfaMethod;
}
