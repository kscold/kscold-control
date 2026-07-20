/**
 * 탭 단위로 관리되는 AI/터미널 세션의 세션 스토리지 키.
 *
 * 여러 레이어가 함께 쓰는 관심사라 `shared` 레이어에 둔다:
 * 인증 스토어가 로그아웃 시 이 값들을 지우고, 여러 feature(terminal,
 * claude-chat, openai-chat)가 읽고 쓴다. 각 feature는 다른 feature의 `lib`를
 * 직접 참조하지 말고 여기서 import 해야 한다 (FSD: 슬라이스 간 참조 금지).
 */
export const TERMINAL_SESSION_STORAGE_KEY = 'terminal_session_id';
export const CLAUDE_SESSION_STORAGE_KEY = 'claude_chat_session_id';
export const OPENAI_SESSION_STORAGE_KEY = 'openai_chat_session_id';

export function getTerminalSessionStorageKey(tabId: string): string {
  return `${TERMINAL_SESSION_STORAGE_KEY}:${tabId}`;
}

export function getClaudeSessionStorageKey(tabId: string): string {
  return `${CLAUDE_SESSION_STORAGE_KEY}:${tabId}`;
}

export function getOpenAISessionStorageKey(tabId: string): string {
  return `${OPENAI_SESSION_STORAGE_KEY}:${tabId}`;
}
