import {
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';

/**
 * 인프라 예외 클래스 모음
 * 외부 서비스나 인프라 연동이 실패했을 때 사용한다.
 */

export class DockerConnectionException extends ServiceUnavailableException {
  constructor(details?: string) {
    super(
      details
        ? `Docker connection failed: ${details}`
        : 'Could not connect to Docker daemon',
    );
  }
}

export class DockerOperationException extends InternalServerErrorException {
  constructor(operation: string, details?: string) {
    super(
      details
        ? `Docker ${operation} failed: ${details}`
        : `Docker ${operation} operation failed`,
    );
  }
}
