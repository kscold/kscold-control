import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { IBlogLogReader } from '../../domain/repositories/log-reader.repository';
import type { BlogLogType } from '../../domain/types/log.type';

const execFileAsync = promisify(execFile);
const BLOG_CONTAINER_NAME = 'ubuntu-blog';
const BLOG_LOG_MAX_BUFFER = 10 * 1024 * 1024;
const BLOG_LOG_FILES: Record<BlogLogType, string> = {
  'blog-backend': '/var/log/kscold-blog-backend.log',
  'blog-backend-err': '/var/log/kscold-blog-backend-err.log',
  'blog-access': '/var/log/kscold-blog/access.log',
  'blog-frontend': '/var/log/kscold-blog-frontend.log',
  'blog-frontend-err': '/var/log/kscold-blog-frontend-err.log',
};

@Injectable()
export class DockerBlogLogReaderRepository implements IBlogLogReader {
  private readonly logger = new Logger(DockerBlogLogReaderRepository.name);

  async readBlogLogs(logType: BlogLogType, lines: number): Promise<string[]> {
    const filePath = BLOG_LOG_FILES[logType];
    if (!filePath) {
      return [`Unknown blog log type: ${logType}`];
    }

    const tail = Math.max(1, Math.floor(lines) || 200);
    try {
      const { stdout } = await execFileAsync(
        'docker',
        ['exec', BLOG_CONTAINER_NAME, 'tail', '-n', String(tail), filePath],
        {
          env: {
            ...process.env,
            DOCKER_HOST:
              process.env.DOCKER_HOST || 'unix:///var/run/docker.sock',
          },
          maxBuffer: BLOG_LOG_MAX_BUFFER,
        },
      );
      return stdout.split('\n').filter((line) => line.trim());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to read blog logs (${logType}): ${message}`);
      return [`Error reading blog log (${logType}): ${message}`];
    }
  }
}
