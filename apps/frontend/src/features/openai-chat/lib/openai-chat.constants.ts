export const API_URL = import.meta.env.VITE_API_URL || '';
export const OPENAI_SESSION_STORAGE_KEY = 'openai_chat_session_id';

export function getOpenAISessionStorageKey(tabId: string): string {
  return `${OPENAI_SESSION_STORAGE_KEY}:${tabId}`;
}
