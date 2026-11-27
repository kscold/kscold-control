import { controlDataPath } from '../../../common/utils/control-data-dir.util';
import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import { join } from 'path';
import { readLastLines } from '../../../common/utils/read-last-lines.util';
import { ILogReader } from '../../domain/repositories/log-reader.repository.interface';

@Injectable()
export class FileLogReaderRepository implements ILogReader {
  private readonly logger = new Logger(FileLogReaderRepository.name);

  /**
   * 파일 로그 읽기 (파일 끝에서 직접 읽어 운영체제와 관계없이 동작)
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

      return await readLastLines(logPath, lines);
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
        return this.findBackendLog('out.log');
      case 'pm2':
        return this.findBackendLog('error.log');
      case 'nginx-access':
        return this.findNginxLog('access.log');
      case 'nginx-error':
        return this.findNginxLog('error.log');
      default:
        throw new Error(`Invalid file log type: ${logType}`);
    }
  }

  /**
   * 운영 환경에서 PM2는 apps/backend를 작업 디렉터리로 백엔드를 띄우지만,
   * 로컬에서는 보통 저장소 루트에서 실행한다. 두 경우를 모두 명시적으로 탐색한다.
   */
  private findBackendLog(filename: 'out.log' | 'error.log'): string {
    const cwd = process.cwd();
    const dataLogs = controlDataPath('logs');
    // PM2 로 띄우면 실제로 쓰는 로그 파일 경로를 환경 변수로 알려 준다. 이걸 먼저 써야
    // 옛 위치에 남은 오래된 파일을 지금 로그처럼 보여 주지 않는다.
    const pm2Path =
      filename === 'out.log'
        ? process.env.pm_out_log_path
        : process.env.pm_err_log_path;
    const candidates = [
      ...(pm2Path ? [pm2Path] : []),
      ...(dataLogs ? [join(dataLogs, filename)] : []),
      join(cwd, 'logs', filename),
      join(cwd, 'apps/backend/logs', filename),
    ];
    return (
      candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0]
    );
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
