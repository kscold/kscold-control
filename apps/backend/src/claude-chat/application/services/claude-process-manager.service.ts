import { Injectable, Logger } from '@nestjs/common';
import { spawn, ChildProcess } from 'child_process';
import { createInterface } from 'readline';
import {
  getHomeDirectory,
  getWorkingDirectory as resolveWorkingDirectory,
  prependClaudeBinaryDir,
  resolveClaudeBinary,
} from '../../../common/utils';

interface ClaudeProcess {
  process: ChildProcess;
  claudeSessionId: string | null;
  isProcessing: boolean;
  totalCostUsd: number;
}

export interface ClaudeStreamEvent {
  type:
    | 'text-delta'
    | 'tool-use'
    | 'tool-result'
    | 'message-end'
    | 'error'
    | 'process-exit';
  text?: string;
  tool?: string;
  input?: any;
  status?: 'start' | 'end';
  content?: string;
  costUsd?: number;
  durationMs?: number;
  totalCostUsd?: number;
  code?: number;
  message?: string;
}

@Injectable()
export class ClaudeProcessManagerService {
  private readonly logger = new Logger(ClaudeProcessManagerService.name);
  private readonly processes = new Map<string, ClaudeProcess>();

  getWorkingDirectory(): string {
    return resolveWorkingDirectory();
  }

  getClaudeBinaryPath(): string | null {
    return resolveClaudeBinary(getHomeDirectory()).binaryPath;
  }

  getTotalCostUsd(sessionId: string): number {
    return this.processes.get(sessionId)?.totalCostUsd ?? 0;
  }

  private serializeToolInput(input: unknown): string {
    if (typeof input === 'string') {
      return input;
    }

    try {
      return JSON.stringify(input).substring(0, 200);
    } catch {
      return '[unserializable tool input]';
    }
  }

  sendPrompt(
    sessionId: string,
    prompt: string,
    onEvent: (event: ClaudeStreamEvent) => void,
  ): void {
    // Kill existing process if still running
    const existing = this.processes.get(sessionId);
    if (existing?.isProcessing) {
      existing.process.kill('SIGINT');
    }

    const args = [
      '-p',
      '--output-format',
      'stream-json',
      '--include-partial-messages', // 실시간 스트리밍 토큰 전송
    ];

    // Resume previous conversation if we have Claude's session ID
    if (existing?.claudeSessionId) {
      args.push('--resume', existing.claudeSessionId);
    }

    args.push(prompt);

    const homeDir = getHomeDirectory();
    const workingDir = this.getWorkingDirectory();
    const claudeBinaryPath = this.getClaudeBinaryPath();
    const command = claudeBinaryPath || 'claude';

    // CLAUDE* 환경변수 제거 (중첩 실행 방지)
    // ANTHROPIC_API_KEY를 명시적으로 넣지 않음 →
    //   PM2 env에 있으면 filteredEnv에 포함됨
    //   없으면 claude가 ~/.claude.json / keychain에서 직접 읽음
    const filteredEnv = Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !key.startsWith('CLAUDE')),
    );

    const child = spawn(command, args, {
      cwd: workingDir,
      env: {
        ...filteredEnv,
        HOME: homeDir,
        PATH: prependClaudeBinaryDir(claudeBinaryPath),
        ...(claudeBinaryPath ? { CLAUDE_CODE_BIN: claudeBinaryPath } : {}),
        CLAUDE_WORKING_DIR: workingDir,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const proc: ClaudeProcess = {
      process: child,
      claudeSessionId: existing?.claudeSessionId || null,
      isProcessing: true,
      totalCostUsd: existing?.totalCostUsd || 0,
    };
    this.processes.set(sessionId, proc);

    let lastTextLength = 0;
    const seenToolKeys = new Set<string>();

    const rl = createInterface({ input: child.stdout });
    rl.on('line', (line) => {
      if (!line.trim()) return;
      try {
        const event = JSON.parse(line);

        // session_id 캡처 (init 이벤트 or result 이벤트)
        if (event.session_id && !proc.claudeSessionId) {
          proc.claudeSessionId = event.session_id;
        }

        if (
          event.type === 'assistant' &&
          Array.isArray(event.message?.content)
        ) {
          for (const block of event.message.content) {
            if (block.type === 'text') {
              // --include-partial-messages: 누적 텍스트에서 새 부분만 추출
              const blockText =
                typeof block.text === 'string'
                  ? block.text
                  : String(block.text || '');
              const newText = blockText.substring(lastTextLength);
              lastTextLength = blockText.length;
              if (newText) {
                onEvent({ type: 'text-delta', text: newText });
              }
            } else if (block.type === 'tool_use') {
              const toolInput = this.serializeToolInput(block.input);
              const toolKey = block.id || `${block.name}:${toolInput}`;

              if (seenToolKeys.has(toolKey)) {
                continue;
              }

              seenToolKeys.add(toolKey);
              onEvent({
                type: 'tool-use',
                tool: block.name,
                input: toolInput,
                status: 'start',
              });
            }
          }
        } else if (event.type === 'result') {
          // session_id가 result에도 있으면 업데이트
          if (event.session_id) {
            proc.claudeSessionId = event.session_id;
          }

          const cost = event.cost_usd || 0;
          proc.totalCostUsd += cost;
          proc.isProcessing = false;
          lastTextLength = 0;
          seenToolKeys.clear();

          onEvent({
            type: 'message-end',
            content: event.result || '',
            costUsd: cost,
            durationMs: event.duration_ms || 0,
            totalCostUsd: proc.totalCostUsd,
          });
        }
      } catch {
        // Non-JSON line (e.g. stderr mixed in), skip
      }
    });

    let stderrBuffer = '';
    child.stderr.on('data', (data) => {
      stderrBuffer += data.toString();
    });

    child.on('error', (err) => {
      proc.isProcessing = false;
      seenToolKeys.clear();
      this.logger.error(`[ClaudeChat] Spawn error: ${err.message}`);
      onEvent({ type: 'error', message: `Claude 실행 실패: ${err.message}` });
      onEvent({ type: 'process-exit', code: -1 });
    });

    child.on('exit', (code) => {
      proc.isProcessing = false;
      lastTextLength = 0;
      seenToolKeys.clear();
      if (code !== 0 && stderrBuffer.trim()) {
        this.logger.error(`Exit ${code}: ${stderrBuffer.trim()}`);
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

  isProcessing(sessionId: string): boolean {
    return this.processes.get(sessionId)?.isProcessing ?? false;
  }

  getClaudeSessionId(sessionId: string): string | null {
    return this.processes.get(sessionId)?.claudeSessionId ?? null;
  }
}
