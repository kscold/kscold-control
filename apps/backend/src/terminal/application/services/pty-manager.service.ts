import { Injectable } from '@nestjs/common';
import * as pty from 'node-pty';
import { IPtyManager } from '../../domain/interfaces/pty-manager.interface';

/**
 * PTY Manager Service
 * Application service for managing PTY (pseudo-terminal) processes
 */
@Injectable()
export class PtyManagerService implements IPtyManager {
  // sessionId -> PTY process mapping
  private readonly processes = new Map<string, pty.IPty>();

  /**
   * Create a new PTY process for a session
   */
  createPty(sessionId: string): pty.IPty {
    // Don't create if already exists
    if (this.processes.has(sessionId)) {
      return this.processes.get(sessionId)!;
    }

    const homeDir = process.env.HOME || '/Users/kscold';
    const shell = pty.spawn('bash', [], {
      name: 'xterm-256color',
      cols: 100,
      rows: 30,
      cwd: homeDir,
      env: process.env,
    });

    this.processes.set(sessionId, shell);
    console.log(`[PTY] Created new PTY for session: ${sessionId}`);

    return shell;
  }

  /**
   * Get existing PTY process for a session
   */
  getPty(sessionId: string): pty.IPty | undefined {
    return this.processes.get(sessionId);
  }

  /**
   * Check if PTY exists for a session
   */
  hasPty(sessionId: string): boolean {
    return this.processes.has(sessionId);
  }

  /**
   * Kill PTY process for a session
   */
  killPty(sessionId: string): void {
    const shell = this.processes.get(sessionId);
    if (shell) {
      shell.kill();
      this.processes.delete(sessionId);
      console.log(`[PTY] Killed PTY for session: ${sessionId}`);
    }
  }

  /**
   * Write data to PTY process
   */
  write(sessionId: string, data: string): void {
    const shell = this.processes.get(sessionId);
    if (shell) {
      shell.write(data);
    }
  }

  /**
   * Resize PTY terminal
   */
  resize(sessionId: string, cols: number, rows: number): void {
    const shell = this.processes.get(sessionId);
    if (shell) {
      shell.resize(cols, rows);
    }
  }

  /**
   * Send interrupt signal (Ctrl+C)
   */
  interrupt(sessionId: string): void {
    const shell = this.processes.get(sessionId);
    if (shell) {
      shell.kill('SIGINT');
    }
  }

  /**
   * Delete PTY from map (called when process exits)
   */
  deletePty(sessionId: string): void {
    this.processes.delete(sessionId);
  }
}
