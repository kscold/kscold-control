import { IsNumber, Min } from 'class-validator';

/**
 * Set Terminal Command Limit DTO
 * Application layer DTO for managing terminal command limits
 */
export class SetTerminalLimitDto {
  @IsNumber()
  @Min(-1) // -1 means unlimited
  limit: number;
}

/**
 * Terminal Command Status Response
 */
export class TerminalCommandStatusDto {
  allowed: boolean;
  remaining: number; // -1 means unlimited
  current?: number;
  limit?: number;
}
