// 세션 스토리지 키는 여러 레이어가 공유하는 관심사라 shared 레이어에 둔다.
export {
  CLAUDE_SESSION_STORAGE_KEY,
  getClaudeSessionStorageKey,
} from '@/shared/lib';

export const API_URL = import.meta.env.VITE_API_URL || '';
