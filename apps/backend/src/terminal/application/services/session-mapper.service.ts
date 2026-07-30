import { Injectable, Logger } from '@nestjs/common';
import { SessionClientMapper } from '../../../common/services';

/**
 * 터미널 세션 전용 클라이언트↔세션 매퍼.
 * 매핑 로직은 공통 기반 클래스에 있고, 터미널만 매핑 변화를 로그로 남긴다.
 */
@Injectable()
export class SessionMapperService extends SessionClientMapper {
  protected readonly logger = new Logger(SessionMapperService.name);
}
