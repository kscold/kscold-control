/**
 * Session storage keys for tab-scoped AI/terminal sessions.
 *
 * These live in the `shared` layer because they are a cross-cutting concern:
 * the auth store clears them on logout, and multiple features (terminal,
 * claude-chat, openai-chat) read/write them. Features must import from here
 * instead of reaching into each other's `lib` (FSD: no cross-slice imports).
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
