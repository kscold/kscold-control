import { Injectable } from '@nestjs/common';
import { SessionClientMapper } from '../../../common/services';

/**
 * OpenAI 챗 게이트웨이 전용 클라이언트↔세션 매퍼.
 * 매핑 로직은 공통 기반 클래스에 있고, 이 모듈은 자기 인스턴스만 갖는다.
 */
@Injectable()
export class OpenAISessionMapperService extends SessionClientMapper {}
