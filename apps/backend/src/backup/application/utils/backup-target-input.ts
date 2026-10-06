import { BadRequestException } from '@nestjs/common';
import { isValidMongodbUri } from '../../domain/policies/backup-target.policy';

/** 오류 메시지에는 URI 를 싣지 않는다. 자격증명이 응답과 로그에 남기 때문이다. */
export function assertValidMongodbUri(uri: string): void {
  if (!isValidMongodbUri(uri)) {
    throw new BadRequestException(
      '접속 URI 형식이 올바르지 않습니다. 비밀번호에 @ / : 같은 문자가 있으면 퍼센트 인코딩해야 합니다.',
    );
  }
}
