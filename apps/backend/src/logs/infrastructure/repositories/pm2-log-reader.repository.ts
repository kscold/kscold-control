import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import { IPm2LogReader } from '../../domain/repositories/log-reader.repository';
import { Pm2LogResult } from '../../domain/types/log.type';

const execAsync = promisify(exec);

@Injectable()
export class Pm2LogReaderRepository implements IPm2LogReader {
  private readonly logger = new Logger(Pm2LogReaderRepository.name);

  async readLogs(lines: number): Promise<string[]> {
    try {
      const result = await this.getPm2Logs(lines);
      return [...result.out, ...result.error];
    } catch (error) {
      this.logger.error('Failed to read PM2 logs:', error.message);
      return [`Error reading logs: ${error.message}`];
    }
  }

  async getPm2Logs(lines: number = 100): Promise<Pm2LogResult> {
    try {
      const { stdout } = await execAsync(
        `pm2 logs kscold-control --lines ${lines} --nostream`,
      );
      const logLines = stdout.split('\n');

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
}
