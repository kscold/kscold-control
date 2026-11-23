import type { Session } from '../entities/session.entity';
import type { Message } from '../entities/message.entity';

/**
 * 세션 매니저 DI 토큰
 * 다른 모듈(claude-chat, openai-chat)은 구현체가 아닌 이 토큰으로 주입받는다.
 */
export const SESSION_MANAGER = Symbol('SESSION_MANAGER');

/**
 * 세션 매니저 포트 (추상)
 *
 * 터미널 세션과 메시지의 영속화 책임을 정의한다.
 * terminal 모듈이 소유·구현하고, 챗 모듈들은 이 추상에만 의존한다(DIP).
 * 시그니처는 구현체인 TerminalSessionService의 public 메서드와 일치한다.
 */
export interface ISessionManager {
  /**
   * 활성 세션을 찾거나 새로 생성한다.
   * 세션과 재접속 여부를 함께 반환한다.
   * @param titlePrefix 새 세션 제목 접두어 — 터미널/claude-chat/openai-chat이 공유하므로 호출자별로 구분
   */
  getOrCreateSession(
    userId: string,
    requestedSessionId?: string,
    titlePrefix?: string,
  ): Promise<{ session: Session; isReconnect: boolean }>;

  /** 세션의 메시지 히스토리 조회 (소유자 검증 포함) */
  getHistory(sessionId: string, userId: string): Promise<Message[]>;

  /** 세션에 메시지 저장 (소유자 검증 포함) */
  saveMessage(
    sessionId: string,
    userId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: Record<string, any>,
  ): Promise<void>;

  /** 세션의 메시지 히스토리 전체 삭제 */
  clearHistory(sessionId: string, userId: string): Promise<void>;

  /** 세션의 최근 활동 시각 갱신 (sessionId 기준) */
  updateActivity(sessionId: string, userId: string): Promise<void>;

  /** 세션 닫기 — 비활성화 처리 */
  closeSession(sessionId: string, userId: string): Promise<void>;

  /**
   * 세션과 소속 메시지 전체 삭제.
   * 세션이 없거나 소유자가 아니면 null을 반환한다.
   */
  deleteSession(sessionId: string, userId: string): Promise<Session | null>;

  /** 이름을 지정한 새 세션 생성 */
  createNamedSession(userId: string, title: string): Promise<Session>;

  /** 세션과 메시지를 함께 조회 */
  loadSessionWithMessages(
    sessionId: string,
    userId: string,
  ): Promise<Session | null>;

  /** 전달받은 세션 엔티티의 최근 활동 시각을 갱신하고 저장 */
  touchSession(session: Session): Promise<void>;
}
