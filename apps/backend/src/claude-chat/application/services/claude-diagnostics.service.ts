import { Injectable, Logger } from '@nestjs/common';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';

interface ClaudeDiagnosticsCheck {
  ok: boolean;
  reason: string | null;
  stdoutLength?: number;
  stderrLength?: number;
  outputLength?: number;
  stdoutPreview?: string;
  stderrPreview?: string;
  outputPreview?: string;
}

export interface ClaudeDiagnosticsReport {
  ok: boolean;
  diagnosedAt: string;
  summary: string;
  recommendation: string | null;
  environment: {
    cwd: string;
    binaryPath: string | null;
    home: string | null;
  };
  macOsSignals: {
    quarantine: string | null;
    spctl: string | null;
  };
  checks: {
    version: ClaudeDiagnosticsCheck;
    interactive: ClaudeDiagnosticsCheck;
  };
}

export interface ClaudeDiagnosticsResponse extends ClaudeDiagnosticsReport {
  cached: boolean;
}

@Injectable()
export class ClaudeDiagnosticsService {
  private readonly logger = new Logger(ClaudeDiagnosticsService.name);
  private readonly cacheTtlMs = 60_000;
  private readonly versionTimeoutMs = 6_000;
  private readonly interactiveTimeoutMs = 10_000;
  private readonly scriptTimeoutMs = 15_000;

  private cachedReport: ClaudeDiagnosticsReport | null = null;
  private cachedAt = 0;
  private pendingRun: Promise<ClaudeDiagnosticsReport> | null = null;

  async getDiagnostics(
    forceRefresh = false,
  ): Promise<ClaudeDiagnosticsResponse> {
    const now = Date.now();
    const cachedReport = this.cachedReport;
    const shouldUseCache =
      !forceRefresh && cachedReport && now - this.cachedAt < this.cacheTtlMs;

    if (shouldUseCache && cachedReport) {
      return {
        ...cachedReport,
        cached: true,
      };
    }

    if (!forceRefresh && this.pendingRun) {
      const report = await this.pendingRun;
      return {
        ...report,
        cached: false,
      };
    }

    this.pendingRun = this.runDiagnosticsScript()
      .then((report) => {
        this.cachedReport = report;
        this.cachedAt = Date.now();
        return report;
      })
      .finally(() => {
        this.pendingRun = null;
      });

    const report = await this.pendingRun;
    return {
      ...report,
      cached: false,
    };
  }

  private resolveSmokeScriptPath(): string {
    const candidates = [
      path.resolve(process.cwd(), 'scripts/claude-smoke.mjs'),
      path.resolve(process.cwd(), '../scripts/claude-smoke.mjs'),
      path.resolve(process.cwd(), '../../scripts/claude-smoke.mjs'),
      path.resolve(__dirname, '../../../../../../scripts/claude-smoke.mjs'),
      path.resolve(__dirname, '../../../../../scripts/claude-smoke.mjs'),
      path.resolve(__dirname, '../../../../scripts/claude-smoke.mjs'),
    ];

    const match = candidates.find((candidate) => existsSync(candidate));
    if (!match) {
      throw new Error('Claude smoke script를 찾지 못했습니다.');
    }

    return match;
  }

  private async runDiagnosticsScript(): Promise<ClaudeDiagnosticsReport> {
    const scriptPath = this.resolveSmokeScriptPath();

    return new Promise((resolve) => {
      const child = spawn(
        process.execPath,
        [
          scriptPath,
          '--json',
          `--version-timeout=${this.versionTimeoutMs}`,
          `--interactive-timeout=${this.interactiveTimeoutMs}`,
        ],
        {
          cwd: process.cwd(),
          env: process.env,
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );

      let stdout = '';
      let stderr = '';
      let settled = false;

      const finish = (report: ClaudeDiagnosticsReport) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(report);
      };

      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        this.logger.error('[ClaudeDiagnostics] Smoke script timed out');
        finish({
          ok: false,
          diagnosedAt: new Date().toISOString(),
          summary: 'Claude 진단 스크립트가 제한 시간 안에 끝나지 않았습니다.',
          recommendation:
            'Claude CLI가 시작 전 단계에서 멈추는지 확인해보세요.',
          environment: {
            cwd: process.cwd(),
            binaryPath: null,
            home: process.env.HOME || null,
          },
          macOsSignals: {
            quarantine: null,
            spctl: null,
          },
          checks: {
            version: {
              ok: false,
              reason: `Smoke script timeout after ${this.scriptTimeoutMs / 1000}s`,
            },
            interactive: {
              ok: false,
              reason: `Smoke script timeout after ${this.scriptTimeoutMs / 1000}s`,
            },
          },
        });
      }, this.scriptTimeoutMs);

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('error', (error) => {
        this.logger.error(
          `[ClaudeDiagnostics] Failed to run smoke script: ${error.message}`,
        );
        finish({
          ok: false,
          diagnosedAt: new Date().toISOString(),
          summary: 'Claude 진단 스크립트를 실행하지 못했습니다.',
          recommendation: error.message,
          environment: {
            cwd: process.cwd(),
            binaryPath: null,
            home: process.env.HOME || null,
          },
          macOsSignals: {
            quarantine: null,
            spctl: null,
          },
          checks: {
            version: {
              ok: false,
              reason: error.message,
            },
            interactive: {
              ok: false,
              reason: error.message,
            },
          },
        });
      });

      child.on('exit', (code) => {
        try {
          const parsed = JSON.parse(stdout) as ClaudeDiagnosticsReport;
          finish(parsed);
        } catch (error) {
          const parseError =
            error instanceof Error ? error.message : 'Unknown parse error';
          this.logger.error(
            `[ClaudeDiagnostics] Failed to parse smoke JSON (code=${code}): ${parseError}`,
          );
          finish({
            ok: false,
            diagnosedAt: new Date().toISOString(),
            summary: 'Claude 진단 결과를 해석하지 못했습니다.',
            recommendation: stderr.trim() || parseError,
            environment: {
              cwd: process.cwd(),
              binaryPath: null,
              home: process.env.HOME || null,
            },
            macOsSignals: {
              quarantine: null,
              spctl: null,
            },
            checks: {
              version: {
                ok: false,
                reason: 'Smoke script returned invalid JSON',
                stdoutPreview: stdout.slice(0, 200),
                stderrPreview: stderr.slice(0, 200),
              },
              interactive: {
                ok: false,
                reason: 'Smoke script returned invalid JSON',
              },
            },
          });
        }
      });
    });
  }
}
