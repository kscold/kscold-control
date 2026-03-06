import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import { join } from 'path';
import { ILogReader } from '../../domain/interfaces/log-reader.repository';

const execAsync = promisify(exec);

@Injectable()
export class FileLogReaderRepository implements ILogReader {
  private readonly logger = new Logger(FileLogReaderRepository.name);

  /**
   * 파일 로그 읽기 (tail 명령어 사용)
   * @param lines 읽을 줄 수
   * @param logType 로그 타입 (backend, nginx-access, nginx-error)
   */
  async readLogs(lines: number, logType?: string): Promise<string[]> {
    try {
      const logPath = this.getLogPath(logType);

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
   * 로그 파일 경로 맵핑
   */
  private getLogPath(logType?: string): string {
    switch (logType) {
      case 'backend':
        return join(process.cwd(), 'apps/backend/logs/out.log');
      case 'pm2':
        return join(process.cwd(), 'apps/backend/logs/error.log');
      case 'nginx-access':
        return this.findNginxLog('access.log');
      case 'nginx-error':
        return this.findNginxLog('error.log');
      default:
        throw new Error(`Invalid file log type: ${logType}`);
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
}
