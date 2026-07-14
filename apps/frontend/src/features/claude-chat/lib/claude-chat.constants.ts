// Session storage keys live in the shared layer (cross-cutting concern).
export {
  CLAUDE_SESSION_STORAGE_KEY,
  getClaudeSessionStorageKey,
} from '@/shared/lib';

export const API_URL = import.meta.env.VITE_API_URL || '';
