import type { Terminal as XTermTerminal } from '@xterm/xterm';
import type { FitAddon } from '@xterm/addon-fit';
import type { Socket } from 'socket.io-client';

/**
 * Terminal Session State
 */
export interface TerminalSession {
  sessionId: string | null;
  isConnected: boolean;
  commandCount: number;
  commandLimit: number;
}

/**
 * Terminal Socket Events
 */
export interface TerminalSocketEvents {
  'terminal:session-ready': (data: {
    sessionId: string;
    isReconnect: boolean;
  }) => void;
  'terminal:output': (data: { type: string; content: string }) => void;
  'terminal:error': (data: { message: string }) => void;
  'terminal:exit': (data: { code: number }) => void;
  'terminal:command-count': (data: {
    count: number;
    limit: number;
    remaining: number;
  }) => void;
  'terminal:limit-reached': (data: { limit: number; count: number }) => void;
}

/**
 * Terminal Refs
 */
export interface TerminalRefs {
  xterm: XTermTerminal | null;
  socket: Socket | null;
  fitAddon: FitAddon | null;
}
