import * as os from 'node:os';
import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ISystemStatusReader } from '../../domain/repositories/log-reader.repository.interface';
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
      // hostname·uptime·vm_stat 명령 대신 Node os 를 써서 윈도우·리눅스에서도 같은 값을 준다.
      const gib = (bytes: number) => (bytes / 1024 ** 3).toFixed(1);
      const uptimeHours = Math.floor(os.uptime() / 3600);
      return {
        hostname: os.hostname(),
        uptime: `${Math.floor(uptimeHours / 24)}일 ${uptimeHours % 24}시간`,
        memory: `사용 ${gib(os.totalmem() - os.freemem())}GiB / 전체 ${gib(os.totalmem())}GiB`,
      };
    } catch (error) {
      this.logger.error('Failed to get system info:', error.message);
      return null;
    }
  }
}
