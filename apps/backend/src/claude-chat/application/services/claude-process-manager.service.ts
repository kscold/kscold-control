import { Injectable, Logger } from '@nestjs/common';
import { spawn, ChildProcess } from 'child_process';
import { createInterface } from 'readline';

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
      '--output-format', 'stream-json',
      '--include-partial-messages', // 실시간 스트리밍 토큰 전송
    ];

    // Resume previous conversation if we have Claude's session ID
    if (existing?.claudeSessionId) {
      args.push('--resume', existing.claudeSessionId);
    }

    args.push(prompt);

    const homeDir = process.env.HOME || '/Users/kscold';

    // CLAUDE* 환경변수 제거 (중첩 실행 방지)
    // ANTHROPIC_API_KEY를 명시적으로 넣지 않음 →
    //   PM2 env에 있으면 filteredEnv에 포함됨
    //   없으면 claude가 ~/.claude.json / keychain에서 직접 읽음
    const filteredEnv = Object.fromEntries(
      Object.entries(process.env).filter(
        ([key]) => !key.startsWith('CLAUDE'),
      ),
    );

    const child = spawn('claude', args, {
      cwd: homeDir,
      env: {
        ...filteredEnv,
        HOME: homeDir,
        PATH: process.env.PATH,
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

    const rl = createInterface({ input: child.stdout });
    rl.on('line', (line) => {
      if (!line.trim()) return;
      try {
        const event = JSON.parse(line);

        // session_id 캡처 (init 이벤트 or result 이벤트)
        if (event.session_id && !proc.claudeSessionId) {
          proc.claudeSessionId = event.session_id;
        }

        if (event.type === 'assistant' && event.message?.content) {
          for (const block of event.message.content) {
            if (block.type === 'text') {
              // --include-partial-messages: 누적 텍스트에서 새 부분만 추출
              const newText = block.text.substring(lastTextLength);
              lastTextLength = block.text.length;
              if (newText) {
                onEvent({ type: 'text-delta', text: newText });
              }
            } else if (block.type === 'tool_use') {
              onEvent({
                type: 'tool-use',
                tool: block.name,
                input:
                  typeof block.input === 'string'
                    ? block.input
                    : JSON.stringify(block.input).substring(0, 200),
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
      this.logger.error(`[ClaudeChat] Spawn error: ${err.message}`);
      onEvent({ type: 'error', message: `Claude 실행 실패: ${err.message}` });
      onEvent({ type: 'process-exit', code: -1 });
    });

    child.on('exit', (code) => {
      proc.isProcessing = false;
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
