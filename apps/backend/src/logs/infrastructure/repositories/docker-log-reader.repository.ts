import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import { IDockerLogReader } from '../../domain/interfaces/log-reader.repository';
import { DockerContainerSummary } from '../../domain/types/log.type';

const execAsync = promisify(exec);

@Injectable()
export class DockerLogReaderRepository implements IDockerLogReader {
  private readonly logger = new Logger(DockerLogReaderRepository.name);

  /**
   * Docker 컨테이너 로그 읽기
   * @param lines 읽을 줄 수
   * @param containerId Docker 컨테이너 ID
   */
  async readLogs(lines: number, containerId?: string): Promise<string[]> {
    try {
      if (!containerId) {
        return ['Container ID is required for docker logs'];
      }

      const { stdout } = await execAsync(
        `docker logs --tail ${lines} ${containerId} 2>&1`,
      );
      return stdout.split('\n').filter((line) => line.trim());
    } catch (error) {
      this.logger.error('Failed to read docker logs:', error.message);
      return [`Error reading logs: ${error.message}`];
    }
  }

  /**
   * Docker 컨테이너 목록 조회
   */
  async listContainers(): Promise<DockerContainerSummary[]> {
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
}
