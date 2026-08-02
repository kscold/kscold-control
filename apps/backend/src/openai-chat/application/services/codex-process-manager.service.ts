import { Injectable, Logger } from '@nestjs/common';
import { spawn, ChildProcess } from 'child_process';
import { createInterface } from 'readline';
import { getWorkingDirectory } from '../../../common/utils';

export interface CodexStreamEvent {
  type: 'text-delta' | 'message-end' | 'error' | 'process-exit';
  text?: string;
  content?: string;
  code?: number;
  message?: string;
}

interface CodexProcess {
  process: ChildProcess;
  isProcessing: boolean;
}

@Injectable()
export class CodexProcessManagerService {
  private readonly logger = new Logger(CodexProcessManagerService.name);
  private readonly processes = new Map<string, CodexProcess>();

  /**
   * Codex 프로세스가 실행될 작업 디렉토리.
   * 폴백이 달라 혼동되지 않도록 다른 프로세스 관리자와 같은 공용 유틸을 쓴다.
   */
  getWorkingDirectory(): string {
    return getWorkingDirectory();
  }

  isProcessing(sessionId: string): boolean {
    return this.processes.get(sessionId)?.isProcessing ?? false;
  }

  resolveCodexBinary(): string {
    return process.env.CODEX_BIN || 'codex';
  }

  sendPrompt(
    sessionId: string,
    prompt: string,
    onEvent: (event: CodexStreamEvent) => void,
  ): void {
    const existing = this.processes.get(sessionId);
    if (existing?.isProcessing) existing.process.kill('SIGINT');

    const binary = this.resolveCodexBinary();
    const workingDir = this.getWorkingDirectory();

    // codex --full-auto -q runs in non-interactive quiet mode
    const child = spawn(binary, ['--full-auto', '-q', prompt], {
      cwd: workingDir,
      env: {
        ...process.env,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const proc: CodexProcess = { process: child, isProcessing: true };
    this.processes.set(sessionId, proc);

    let fullContent = '';
    let stderrBuffer = '';

    const rl = createInterface({ input: child.stdout });
    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // codex may output JSON events or plain text depending on version
      try {
        const event = JSON.parse(trimmed);
        // Handle codex JSON streaming format
        if (event.type === 'text' || event.type === 'output') {
          const text = event.content ?? event.text ?? '';
          if (text) {
            fullContent += text;
            onEvent({ type: 'text-delta', text });
          }
        } else if (event.type === 'done' || event.type === 'result') {
          proc.isProcessing = false;
          onEvent({ type: 'message-end', content: fullContent });
          fullContent = '';
        }
      } catch {
        // Plain text output — stream as-is
        fullContent += trimmed + '\n';
        onEvent({ type: 'text-delta', text: trimmed + '\n' });
      }
    });

    child.stderr.on('data', (data: Buffer) => {
      stderrBuffer += data.toString();
    });

    child.on('error', (err) => {
      proc.isProcessing = false;
      this.logger.error(`[Codex] Spawn error: ${err.message}`);
      onEvent({
        type: 'error',
        message: `Codex 실행 실패: ${err.message}. npm i -g @openai/codex 로 설치하세요.`,
      });
      onEvent({ type: 'process-exit', code: -1 });
    });

    child.on('exit', (code) => {
      proc.isProcessing = false;

      if (fullContent) {
        onEvent({ type: 'message-end', content: fullContent });
        fullContent = '';
      } else if (code !== 0 && stderrBuffer.trim()) {
        this.logger.error(`[Codex] Exit ${code}: ${stderrBuffer.trim()}`);
        onEvent({ type: 'error', message: stderrBuffer.trim() });
      }

      onEvent({ type: 'process-exit', code: code ?? 0 });
    });
  }

  abort(sessionId: string): void {
    const proc = this.processes.get(sessionId);
    if (proc?.isProcessing) {
      proc.process.kill('SIGINT');
      proc.isProcessing = false;
    }
  }

  kill(sessionId: string): void {
    const proc = this.processes.get(sessionId);
    if (proc) {
      proc.process.kill('SIGTERM');
      this.processes.delete(sessionId);
    }
  }
}
