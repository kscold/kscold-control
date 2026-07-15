import { Expose, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const MIN_TOPOLOGY_POSITION = -100_000;
const MAX_TOPOLOGY_POSITION = 100_000;

/** 토폴로지 노드 좌표 요청 항목임. */
export class TopologyNodePositionRequestDto {
  @Expose()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  nodeId!: string;

  @Expose()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(MIN_TOPOLOGY_POSITION)
  @Max(MAX_TOPOLOGY_POSITION)
  x!: number;

  @Expose()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(MIN_TOPOLOGY_POSITION)
  @Max(MAX_TOPOLOGY_POSITION)
  y!: number;
}

/** 사용자별 토폴로지 레이아웃 저장 HTTP 요청 전송 객체임. */
export class UpdateTopologyLayoutRequestDto {
  @Expose()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => TopologyNodePositionRequestDto)
  positions!: TopologyNodePositionRequestDto[];
}
