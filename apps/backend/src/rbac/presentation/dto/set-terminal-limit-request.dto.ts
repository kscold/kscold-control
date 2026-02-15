import { IsNumber, Min } from 'class-validator';

/**
 * Set Terminal Limit Request DTO
 * Presentation layer DTO for HTTP requests
 */
export class SetTerminalLimitRequestDto {
  @IsNumber()
  @Min(-1)
  limit: number;
}
