export type OpenAIProvider = 'api' | 'codex';

/**
 * 백엔드 messages 테이블의 role 컬럼 값 집합.
 * (apps/backend/src/terminal/domain/entities/message.entity.ts)
 * OpenAI 게이트웨이는 'user'/'assistant'만 저장하지만 컬럼 자체는 'system'도 허용한다.
 */
export type OpenAIChatRole = 'user' | 'assistant' | 'system';

/**
 * 화면에 렌더링되는 메시지 (히스토리 + 스트리밍 결과를 합친 UI 모델).
 * 히스토리를 role 필터 없이 그대로 싣기 때문에 role은 백엔드 컬럼과 동일한 범위를 갖는다.
 */
export interface OpenAIChatMessage {
  id: string;
  role: OpenAIChatRole;
  content: string;
  provider?: OpenAIProvider;
  model?: string;
  timestamp: string;
  isStreaming?: boolean;
}

/**
 * OpenAI 챗 메시지의 metadata (백엔드 jsonb 컬럼).
 * assistant 메시지를 저장할 때 게이트웨이가 아래 값을 채워 넣는다.
 * (apps/backend/src/openai-chat/presentation/gateways/openai-chat.gateway.ts:182-192)
 * user 메시지는 metadata 없이 저장되므로 히스토리에서 null로 내려온다.
 */
export interface OpenAIMessageMetadata {
  /** 저장 주체 구분자 — OpenAI 챗이 저장한 메시지는 항상 'openai-chat' */
  type?: 'openai-chat';
  /** 응답을 생성한 경로 (Chat API / Codex CLI) */
  provider?: OpenAIProvider;
  /** 응답 모델명 — Chat API 경로에서만 채워진다 (openai-chat.gateway.ts:237) */
  model?: string;
  /** jsonb라 위에 명시하지 않은 키가 섞여 있을 수 있어 열어 둔다 */
  [key: string]: unknown;
}

/**
 * openai:history 이벤트로 내려오는 메시지 1건.
 * 게이트웨이가 엔티티에서 role/content/metadata/timestamp만 추려 보낸다.
 * (openai-chat.gateway.ts:108-115)
 */
export interface OpenAIHistoryMessage {
  /**
   * 현재 게이트웨이 emit 페이로드에는 없는 필드다.
   * 프론트에서 없으면 자체 생성하므로, 추후 추가될 때를 대비해 선택 필드로 둔다.
   */
  id?: string;
  role: OpenAIChatRole;
  content: string;
  /** metadata 없이 저장된 메시지(user 등)는 null로 온다 */
  metadata?: OpenAIMessageMetadata | null;
  /** 엔티티는 Date지만 socket.io의 JSON 직렬화를 거쳐 ISO 문자열로 도착한다 */
  timestamp: string;
}

/** openai:history 이벤트 payload (openai-chat.gateway.ts:108-115) */
export interface OpenAIHistoryPayload {
  messages: OpenAIHistoryMessage[];
}

export interface OpenAIChatSession {
  sessionId: string | null;
  isConnected: boolean;
  isReady: boolean;
  provider: OpenAIProvider;
  model: string;
  apiConfigured: boolean;
  lastError: string | null;
}
