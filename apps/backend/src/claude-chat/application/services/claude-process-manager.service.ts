import { Injectable } from '@nestjs/common';
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

    const args = ['-p', '--output-format', 'stream-json'];

    // Resume if we have Claude's session ID
    if (existing?.claudeSessionId) {
      args.push('--resume', existing.claudeSessionId);
    }

    args.push(prompt);

    const homeDir = process.env.HOME || '/Users/kscold';
    const child = spawn('claude', args, {
      cwd: homeDir,
      env: {
        ...Object.fromEntries(
          Object.entries(process.env).filter(
            ([key]) => !key.startsWith('CLAUDE'),
          ),
        ),
        HOME: homeDir,
        PATH: process.env.PATH,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
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
      try {
        const event = JSON.parse(line);

        // Capture session ID
        if (event.session_id && !proc.claudeSessionId) {
          proc.claudeSessionId = event.session_id;
        }

        if (event.type === 'assistant' && event.message?.content) {
          for (const block of event.message.content) {
            if (block.type === 'text') {
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
            } else if (block.type === 'tool_result') {
              onEvent({
                type: 'tool-result',
                content:
                  typeof block.content === 'string'
                    ? block.content.substring(0, 500)
                    : JSON.stringify(block.content).substring(0, 500),
              });
            }
          }
        } else if (event.type === 'result') {
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
        // Non-JSON line, skip
      }
    });

    let stderrBuffer = '';
    child.stderr.on('data', (data) => {
      stderrBuffer += data.toString();
    });

    child.on('exit', (code) => {
      proc.isProcessing = false;
      if (code !== 0 && stderrBuffer.trim()) {
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
