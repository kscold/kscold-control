export const API_URL = import.meta.env.VITE_API_URL || '';
export const SESSION_STORAGE_KEY = 'terminal_session_id';
export const AUTO_REFRESH_INTERVAL = 5000;

/**
 * Terminal Theme
 */
export const TERMINAL_THEME = {
  background: '#1e1e1e',
  foreground: '#d4d4d4',
};

/**
 * Terminal Font Settings
 */
export const TERMINAL_FONT = {
  desktop: 14,
  mobile: 12,
  family: 'Menlo, Monaco, "Courier New", monospace',
};

/**
 * Terminal Color Codes
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
