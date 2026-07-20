// 세션 스토리지 키는 여러 레이어가 공유하는 관심사라 shared 레이어에 둔다.
// 기존 코드와의 호환을 위해 예전 이름인 `SESSION_STORAGE_KEY`로 재export 한다.
export {
  TERMINAL_SESSION_STORAGE_KEY as SESSION_STORAGE_KEY,
  getTerminalSessionStorageKey,
} from '@/shared/lib';

export const API_URL = import.meta.env.VITE_API_URL || '';
export const AUTO_REFRESH_INTERVAL = 5000;

/**
 * 터미널 테마
 */
export const TERMINAL_THEME = {
  background: '#1e1e1e',
  foreground: '#d4d4d4',
};

/**
 * 터미널 폰트 설정
 * `Apple SD Gothic Neo` 같은 proportional 폰트가 fallback 으로 잡히면 셀 너비가 어긋나
 * 모바일 Safari 에서 글자 간격이 벌어진 것처럼 깨진다 — 반드시 monospace 만 나열한다.
 */
export const TERMINAL_FONT = {
  desktop: 14,
  mobile: 12,
  family:
    '"D2Coding", "JetBrains Mono", ui-monospace, Menlo, Monaco, Consolas, "Courier New", monospace',
};

/**
 * 터미널 ANSI 색상 코드
 */
export const TERMINAL_COLORS = {
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  reset: '\x1b[0m',
};
