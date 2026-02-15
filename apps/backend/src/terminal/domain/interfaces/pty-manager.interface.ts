import * as pty from 'node-pty';

/**
 * PTY Manager Interface
 * Domain interface for managing PTY processes
 */
export interface IPtyManager {
  /**
   * Create a new PTY process for a session
   */
  createPty(sessionId: string): pty.IPty;

  /**
   * Get existing PTY process for a session
   */
  getPty(sessionId: string): pty.IPty | undefined;

  /**
   * Check if PTY exists for a session
   */
  hasPty(sessionId: string): boolean;

  /**
   * Kill PTY process for a session
   */
  killPty(sessionId: string): void;

  /**
   * Write data to PTY process
   */
  write(sessionId: string, data: string): void;

  /**
   * Resize PTY terminal
   */
  resize(sessionId: string, cols: number, rows: number): void;

  /**
   * Send interrupt signal (Ctrl+C)
   */
  interrupt(sessionId: string): void;
}

export const PTY_MANAGER = Symbol('PTY_MANAGER');
