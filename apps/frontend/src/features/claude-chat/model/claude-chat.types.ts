/**
 * 백엔드 messages 테이블의 role 컬럼 값 집합.
 * (apps/backend/src/terminal/domain/entities/message.entity.ts)
 * 'system'은 터미널 출력 저장용이라 Claude 챗 UI에서는 걸러진다.
 */
export type ChatMessageRole = 'user' | 'assistant' | 'system';

/** 화면에 렌더링되는 메시지 (히스토리 + 스트리밍 결과를 합친 UI 모델) */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tools?: ToolUse[];
  costUsd?: number;
  durationMs?: number;
  timestamp: Date;
  isStreaming?: boolean;
}

/**
 * Claude 챗 메시지의 metadata (백엔드 jsonb 컬럼).
 * assistant 메시지를 저장할 때 게이트웨이가 아래 값을 채워 넣는다.
 * (apps/backend/src/claude-chat/presentation/gateways/claude-chat.gateway.ts:194-206)
 * user 메시지는 metadata 없이 저장되므로 히스토리에서 null로 내려온다.
 */
export interface ClaudeMessageMetadata {
  /** 저장 주체 구분자 — Claude 챗이 저장한 메시지는 항상 'claude-chat' */
  type?: 'claude-chat';
  /** 응답 1건의 비용(USD) */
  costUsd?: number;
  /** 응답 1건의 처리 시간(ms) */
  durationMs?: number;
  /** 세션 누적 비용(USD) */
  totalCostUsd?: number;
  /** jsonb라 위에 명시하지 않은 키가 섞여 있을 수 있어 열어 둔다 */
  [key: string]: unknown;
}

/**
 * claude:history 이벤트로 내려오는 메시지 1건.
 * 게이트웨이가 엔티티에서 role/content/metadata/timestamp만 추려 보낸다.
 * (claude-chat.gateway.ts:110-117)
 */
export interface ClaudeHistoryMessage {
  role: ChatMessageRole;
  content: string;
  /** metadata 없이 저장된 메시지(user 등)는 null로 온다 */
  metadata?: ClaudeMessageMetadata | null;
  /** 엔티티는 Date지만 socket.io의 JSON 직렬화를 거쳐 ISO 문자열로 도착한다 */
  timestamp: string;
}

/** claude:history 이벤트 payload (claude-chat.gateway.ts:110-117) */
export interface ClaudeHistoryPayload {
  messages: ClaudeHistoryMessage[];
}

export interface ToolUse {
  tool: string;
  input: string;
  status: 'start' | 'end';
}

export interface ClaudeChatSession {
  sessionId: string | null;
  isConnected: boolean;
  isReady: boolean;
  totalCostUsd: number;
  workingDirectory: string | null;
  lastError: string | null;
}
