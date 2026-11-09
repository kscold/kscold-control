import { BadRequestException } from '@nestjs/common';
import {
  SAME_HOST_ALIAS,
  isValidMongodbUri,
  usesLoopbackHost,
} from '../../domain/policies/backup-target.policy';

/** 오류 메시지에는 URI 를 싣지 않는다. 자격증명이 응답과 로그에 남기 때문이다. */
export function assertValidMongodbUri(
  uri: string,
  networkContainer?: string | null,
): void {
  if (!isValidMongodbUri(uri)) {
    throw new BadRequestException(
      '접속 URI 형식이 올바르지 않습니다. 비밀번호에 @ / : 같은 문자가 있으면 퍼센트 인코딩해야 합니다.',
    );
  }
  // 컨테이너의 네트워크를 함께 쓰면 127.0.0.1 은 그 컨테이너 안의 DB 를 가리킨다.
  if (!networkContainer && usesLoopbackHost(uri)) {
    throw new BadRequestException(
      `덤프는 별도 컨테이너에서 실행되어 localhost·127.0.0.1 은 이 서버가 아니라 그 컨테이너를 가리킵니다. 같은 서버의 DB 는 호스트에 공개된 포트로 ${SAME_HOST_ALIAS}:<포트> 처럼 적거나, 포트가 없는 컨테이너라면 접속 컨테이너를 지정해 주세요.`,
    );
  }
}
