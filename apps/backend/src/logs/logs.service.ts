import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

export type LogType =
  | 'backend'
  | 'nginx-access'
  | 'nginx-error'
  | 'docker'
  | 'pm2';

@Injectable()
export class LogsService {
  private readonly logger = new Logger(LogsService.name);

  /**
   * 로그 파일 경로 맵핑
   */
  private getLogPath(logType: LogType, containerId?: string): string {
    switch (logType) {
      case 'backend':
        return join(process.cwd(), 'apps/backend/logs/out.log');
      case 'pm2':
        return join(process.cwd(), 'apps/backend/logs/error.log');
      case 'nginx-access':
        return this.findNginxLog('access.log');
      case 'nginx-error':
        return this.findNginxLog('error.log');
      case 'docker':
        return containerId
          ? `/var/lib/docker/containers/${containerId}/${containerId}-json.log`
          : '';
      default:
        throw new Error('Invalid log type');
    }
  }

  /**
   * Nginx 로그 경로 탐색 (macOS homebrew / Linux 모두 지원)
   */
  private findNginxLog(filename: string): string {
    const candidates = [
      `/opt/homebrew/var/log/nginx/${filename}`,
      `/usr/local/var/log/nginx/${filename}`,
      `/var/log/nginx/${filename}`,
    ];
    return candidates.find((p) => fs.existsSync(p)) || candidates[0];
  }

  /**
   * 로그 파일 읽기 (최근 N줄)
   */
  async getLogs(
    logType: LogType,
    lines: number = 100,
    containerId?: string,
  ): Promise<string[]> {
    try {
      const logPath = this.getLogPath(logType, containerId);

      // Docker 로그는 docker logs 명령어 사용
      if (logType === 'docker' && containerId) {
        const { stdout } = await execAsync(
          `docker logs --tail ${lines} ${containerId} 2>&1`,
        );
        return stdout.split('\n').filter((line) => line.trim());
      }

      // 일반 파일 로그
      if (!fs.existsSync(logPath)) {
        this.logger.warn(`Log file not found: ${logPath}`);
        return [`Log file not found: ${logPath}`];
      }

      const { stdout } = await execAsync(`tail -n ${lines} "${logPath}"`);
      return stdout.split('\n').filter((line) => line.trim());
    } catch (error) {
      this.logger.error(`Failed to read logs (${logType}):`, error.message);
      return [`Error reading logs: ${error.message}`];
    }
  }

  /**
   * PM2 로그 조회
   */
  async getPm2Logs(
    lines: number = 100,
  ): Promise<{ out: string[]; error: string[] }> {
    try {
      const { stdout } = await execAsync(
        `pm2 logs kscold-control --lines ${lines} --nostream`,
      );
      const logLines = stdout.split('\n');

      // out.log와 error.log 분리
      const outLogs: string[] = [];
      const errorLogs: string[] = [];
      let currentType: 'out' | 'error' | null = null;

      for (const line of logLines) {
        if (line.includes('out.log')) {
          currentType = 'out';
          continue;
        } else if (line.includes('error.log')) {
          currentType = 'error';
          continue;
        }

        if (currentType === 'out' && line.trim()) {
          outLogs.push(line);
        } else if (currentType === 'error' && line.trim()) {
          errorLogs.push(line);
        }
      }

      return { out: outLogs, error: errorLogs };
    } catch (error) {
      this.logger.error('Failed to get PM2 logs:', error.message);
      return { out: [], error: [] };
    }
  }

  /**
   * Docker 컨테이너 목록 조회
   */
  async getDockerContainers(): Promise<
    Array<{ id: string; name: string; status: string }>
  > {
    try {
      const { stdout } = await execAsync(
        'docker ps -a --format "{{.ID}}|{{.Names}}|{{.Status}}"',
      );
      return stdout
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => {
          const [id, name, status] = line.split('|');
          return { id, name, status };
        });
    } catch (error) {
      this.logger.error('Failed to get docker containers:', error.message);
      return [];
    }
  }

  /**
   * Nginx 상태 확인
   */
  async getNginxStatus(): Promise<{ running: boolean; version?: string }> {
    try {
      const { stdout: versionOutput } = await execAsync('nginx -v 2>&1');
      const versionMatch = versionOutput.match(/nginx\/([0-9.]+)/);
      const version = versionMatch ? versionMatch[1] : 'unknown';

      // nginx 프로세스 확인
      try {
        await execAsync('pgrep nginx');
        return { running: true, version };
      } catch {
        return { running: false, version };
      }
    } catch (error) {
      return { running: false };
    }
  }

  /**
   * 시스템 정보 조회
   */
  async getSystemInfo(): Promise<any> {
    try {
      const { stdout: hostname } = await execAsync('hostname');
      const { stdout: uptime } = await execAsync('uptime');
      const { stdout: memory } = await execAsync('vm_stat | head -5');

      return {
        hostname: hostname.trim(),
        uptime: uptime.trim(),
        memory: memory.trim(),
      };
    } catch (error) {
      this.logger.error('Failed to get system info:', error.message);
      return null;
    }
  }
}
