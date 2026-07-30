import { NotFoundException } from '@nestjs/common';

/**
 * 도메인 예외 클래스 모음
 * 도메인 엔티티를 찾지 못했을 때 사용한다.
 */

export class ContainerNotFoundException extends NotFoundException {
  constructor(identifier?: string) {
    super(
      identifier
        ? `Container with identifier '${identifier}' not found`
        : 'Container not found',
    );
  }
}
