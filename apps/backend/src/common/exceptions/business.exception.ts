import { BadRequestException } from '@nestjs/common';

/**
 * 비즈니스 예외 클래스 모음
 * 업무 규칙을 위반했을 때 사용한다.
 */

export class InvalidResourceConfigException extends BadRequestException {
  constructor(reason: string) {
    super(`Invalid resource configuration: ${reason}`);
  }
}
