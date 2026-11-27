import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import {
  MAX_INTERVAL_SECONDS,
  MIN_INTERVAL_SECONDS,
} from '../../domain/policies/monitor-status.policy';

export class CreateServiceMonitorDto {
  @IsString()
  @Length(1, 80)
  name: string;

  @IsString()
  @Length(8, 500)
  url: string;

  @IsOptional()
  @IsInt()
  @Min(MIN_INTERVAL_SECONDS)
  @Max(MAX_INTERVAL_SECONDS)
  intervalSeconds?: number;
}
