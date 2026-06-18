import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ISystemStatusReader } from '../../domain/interfaces/log-reader.repository';
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
        return { running: false, version };
      }
    } catch {
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
