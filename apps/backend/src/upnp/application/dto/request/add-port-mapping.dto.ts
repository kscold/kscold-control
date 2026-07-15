import { Exclude, Expose, plainToInstance } from 'class-transformer';
import type { PortMappingDraft } from '../../../domain/types/port-mapping.type';

/** UPnP 포트 매핑 추가 유스케이스 입력 구조임. */
export interface AddPortMappingInput {
  publicPort: number;
  privatePort: number;
  protocol?: 'TCP' | 'UDP';
  description?: string;
}

/** UPnP 포트 매핑 추가 애플리케이션 요청 전송 객체임. */
@Exclude()
export class AddPortMappingDto {
  @Expose()
  publicPort!: number;

  @Expose()
  privatePort!: number;

  @Expose()
  protocol?: 'TCP' | 'UDP';

  @Expose()
  description?: string;

  /** 표현 계층 입력에서 허용한 필드만 유스케이스 명령으로 복사함. */
  static from(input: AddPortMappingInput): AddPortMappingDto {
    return plainToInstance(AddPortMappingDto, input, {
      excludeExtraneousValues: true,
    });
  }

  /** 게이트웨이 포트가 요구하는 도메인 구성값으로 변환함. */
  toDraft(): PortMappingDraft {
    return {
      publicPort: this.publicPort,
      privatePort: this.privatePort,
      protocol: this.protocol,
      description: this.description,
    };
  }
}
