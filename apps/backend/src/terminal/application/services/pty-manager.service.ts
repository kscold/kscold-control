import { Injectable, Logger } from '@nestjs/common';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import * as pty from 'node-pty';
import { IPtyManager } from '../../domain/interfaces/pty-manager.interface';
import {
  prependClaudeBinaryDir,
  resolveClaudeBinary,
} from '../../../common/utils';

/**
 * PTY Manager Service
 * Application service for managing PTY (pseudo-terminal) processes
 */
@Injectable()
export class PtyManagerService implements IPtyManager {
  private readonly logger = new Logger(PtyManagerService.name);

  // sessionId -> PTY process mapping
  private readonly processes = new Map<string, pty.IPty>();

  private getHomeDirectory(): string {
    return process.env.HOME || '/Users/kscold';
  }

  getShellPath(): string {
    return '/bin/zsh';
  }

  getWorkingDirectory(): string {
    return process.env.CLAUDE_WORKING_DIR || this.getHomeDirectory();
  }

  getClaudeBinaryPath(): string | null {
    return resolveClaudeBinary(this.getHomeDirectory()).binaryPath;
  }

  getClaudeLaunchCommand(): string {
    return resolveClaudeBinary(this.getHomeDirectory()).launchCommand;
  }

  private shellQuote(value: string): string {
    return `'${value.replace(/'/g, `'"'"'`)}'`;
  }

  private sourceIfExists(targetPath: string): string {
    return `if [ -f ${this.shellQuote(targetPath)} ]; then source ${this.shellQuote(targetPath)}; fi`;
  }

  private ensureZshBootstrapDirectory(
    homeDir: string,
    workingDir: string,
    claudeBinaryPath: string | null,
  ): string {
    const bootstrapDir = path.join(homeDir, '.kscold-control-shell');
    mkdirSync(bootstrapDir, { recursive: true });

    const claudeEnvLines = claudeBinaryPath
      ? [
          `export CLAUDE_CODE_BIN=${this.shellQuote(claudeBinaryPath)}`,
          `export PATH=${this.shellQuote(prependClaudeBinaryDir(claudeBinaryPath))}`,
        ]
      : [];

    const zshrcLines = [
      this.sourceIfExists(path.join(homeDir, '.zshrc')),
      ...claudeEnvLines,
      'if [ -n "$CLAUDE_CODE_BIN" ]; then',
      '  function claude() { "$CLAUDE_CODE_BIN" "$@"; }',
      'fi',
      '',
    ].join('\n');

    const fileContents: Record<string, string> = {
      '.zshenv': [
        this.sourceIfExists(path.join(homeDir, '.zshenv')),
        `export CLAUDE_WORKING_DIR=${this.shellQuote(workingDir)}`,
        ...claudeEnvLines,
        '',
      ].join('\n'),
      '.zprofile': [
        this.sourceIfExists(path.join(homeDir, '.zprofile')),
        '',
      ].join('\n'),
      '.zshrc': zshrcLines,
      '.zlogin': [this.sourceIfExists(path.join(homeDir, '.zlogin')), ''].join(
        '\n',
      ),
      '.zlogout': [
        this.sourceIfExists(path.join(homeDir, '.zlogout')),
        '',
      ].join('\n'),
    };

    Object.entries(fileContents).forEach(([filename, content]) => {
      const targetPath = path.join(bootstrapDir, filename);
      writeFileSync(targetPath, content, 'utf8');
    });

    return bootstrapDir;
  }

  /**
   * Create a new PTY process for a session
   */
  createPty(sessionId: string): pty.IPty {
    // Don't create if already exists
    if (this.processes.has(sessionId)) {
      return this.processes.get(sessionId)!;
    }

    const homeDir = this.getHomeDirectory();
    const workingDir = this.getWorkingDirectory();
    const shellPath = this.getShellPath();
    const claudeBinaryPath = this.getClaudeBinaryPath();
    const zdotdir = this.ensureZshBootstrapDirectory(
      homeDir,
      workingDir,
      claudeBinaryPath,
    );
    const shell = pty.spawn(shellPath, ['-l'], {
      name: 'xterm-256color',
      cols: 100,
      rows: 30,
      cwd: workingDir,
      env: {
        ...Object.fromEntries(
          Object.entries(process.env).filter(
            ([key]) => !key.startsWith('CLAUDE'),
          ),
        ),
        HOME: homeDir,
        SHELL: shellPath,
        ZDOTDIR: zdotdir,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        CLAUDE_WORKING_DIR: workingDir,
        ...(claudeBinaryPath
          ? {
              CLAUDE_CODE_BIN: claudeBinaryPath,
              PATH: prependClaudeBinaryDir(claudeBinaryPath),
            }
          : {
              PATH: process.env.PATH,
            }),
      },
    });

    this.processes.set(sessionId, shell);
    this.logger.log(`[PTY] Created new PTY for session: ${sessionId}`);

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
      this.logger.log(`[PTY] Killed PTY for session: ${sessionId}`);
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
