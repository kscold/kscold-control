import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ISystemStatusReader } from '../../domain/repositories/log-reader.repository';
import { NginxStatus, SystemInfo } from '../../domain/types/log.type';

const execAsync = promisify(exec);

@Injectable()
export class SystemStatusReaderRepository implements ISystemStatusReader {
  private readonly logger = new Logger(SystemStatusReaderRepository.name);

  async getNginxStatus(): Promise<NginxStatus> {
    try {
      const { stdout: versionOutput } = await execAsync('nginx -v 2>&1');
      const versionMatch = versionOutput.match(/nginx\/([0-9.]+)/);
      const version = versionMatch ? versionMatch[1] : 'unknown';

      try {
        await execAsync('pgrep nginx');
        return { running: true, version };
      } catch {
        // pgrep 실패는 프로세스가 없다는 뜻이므로 정상적인 결과다.
        return { running: false, version };
      }
    } catch (error) {
      // 여기까지 오면 nginx 명령 자체를 실행하지 못한 것이다.
      // "중지됨"과 결과가 같아 구분이 안 되므로 원인을 남긴다.
      this.logger.warn(
        `nginx 상태를 확인하지 못했습니다: ${(error as Error).message}`,
      );
      return { running: false };
    }
  }

  async getSystemInfo(): Promise<SystemInfo | null> {
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
