import { Injectable, Logger } from '@nestjs/common';
import {
  exec,
  spawn,
  type ChildProcessWithoutNullStreams,
} from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { IDockerLogReader } from '../../domain/interfaces/log-reader.repository';
import {
  DockerContainerSummary,
  DockerLogArchiveSource,
  DockerLogReadOptions,
} from '../../domain/types/log.type';

const execAsync = promisify(exec);
const DOCKER_LOG_MAX_BUFFER = 50 * 1024 * 1024;
const DOCKER_ARCHIVE_MAX_BUFFER = 200 * 1024 * 1024;
const NGINX_ACCESS_PATTERN =
  /(?:^|\s)\[[0-9]{2}\/[A-Za-z]{3}\/[0-9]{4}:[0-9:]{8}\s[+\-][0-9]{4}\]\s"[A-Z]+ .* HTTP\/[0-9.]+"/;
const NGINX_ERROR_PATTERN =
  /\[(?:emerg|alert|crit|error|warn|notice|info|debug)\]/i;
const GENERIC_ERROR_PATTERN =
  /(?:^|[\s\]])(?:error|warn|fatal|panic|exception|traceback|failed|denied|critical)(?:[\s:\]])/i;
const DURATION_PATTERN = /^(\d+)([smhd])$/i;

interface DockerLogFileInfo {
  containerId: string;
  containerName: string;
  logPath: string;
  logType: string;
}

interface DockerJsonLogRecord {
  log?: string;
  stream?: string;
  time?: string;
}

@Injectable()
export class DockerLogReaderRepository implements IDockerLogReader {
  private readonly logger = new Logger(DockerLogReaderRepository.name);

  async readLogs(lines: number, containerId?: string): Promise<string[]> {
    return this.readContainerLogs({
      containerId,
      tail: lines,
    });
  }

  async readContainerLogs(options: DockerLogReadOptions): Promise<string[]> {
    try {
      if (!options.containerId) {
        return ['Container ID is required for docker logs'];
      }

      const containerId = this.sanitizeContainerId(options.containerId);
      const tail = this.resolveTail(options.tail);
      const args = ['logs', '--tail', tail];

      if (options.timestamps) {
        args.push('--timestamps');
      }

      if (options.since) {
        args.push('--since', this.sanitizeSince(options.since));
      }

      if (options.until) {
        args.push('--until', this.sanitizeSince(options.until));
      }

      args.push(containerId);

      const { stdout } = await execAsync(`docker ${args.join(' ')}`, {
        maxBuffer: DOCKER_LOG_MAX_BUFFER,
      });
      const lines = stdout.split('\n').filter((line) => line.trim());
      return this.applyFilters(lines, options);
    } catch (error) {
      this.logger.error('Failed to read docker logs:', error.message);
      return [`Error reading logs: ${error.message}`];
    }
  }

  async readArchiveLogs(
    options: DockerLogReadOptions & { sourceId: string },
  ): Promise<string[]> {
    try {
      if (!options.containerId) {
        return ['Container ID is required for archive logs'];
      }

      const sources = await this.listArchiveSources(options.containerId);
      const source = sources.find((item) => item.id === options.sourceId);
      if (!source) {
        return [`Archive source not found: ${options.sourceId}`];
      }

      const readerCommand = source.compressed
        ? `gzip -cd -- ${this.quoteShell(source.path)}`
        : `cat -- ${this.quoteShell(source.path)}`;
      const remoteCommand =
        options.tail === 'all'
          ? readerCommand
          : `${readerCommand} | tail -n ${this.resolveNumericTail(options.tail)}`;

      const stdout = await this.runDockerHostShell(
        remoteCommand,
        DOCKER_ARCHIVE_MAX_BUFFER,
        source.path,
      );

      const formatted = stdout
        .split('\n')
        .map((line) => this.formatArchiveJsonLine(line, options.timestamps))
        .filter((line): line is string => Boolean(line));

      const windowRange = this.resolveTimeRange(options.since, options.until);
      const timeFiltered =
        windowRange === null
          ? formatted
          : formatted.filter((line) => this.isWithinTimeRange(line, windowRange));

      return this.applyFilters(timeFiltered, options);
    } catch (error) {
      this.logger.error('Failed to read docker archive logs:', error.message);
      return [`Error reading archive logs: ${error.message}`];
    }
  }

  async listArchiveSources(
    containerId: string,
  ): Promise<DockerLogArchiveSource[]> {
    try {
      const logInfo = await this.inspectContainerLogFile(containerId);
      if (logInfo.logType !== 'json-file' || !logInfo.logPath) {
        return [];
      }

      const directory = path.posix.dirname(logInfo.logPath);
      const basename = path.posix.basename(logInfo.logPath);
      const listCommand = [
        `cd ${this.quoteShell(directory)}`,
        `for file in ${basename}*; do`,
        '  [ -f "$file" ] || continue',
        `  stat -c '%n|%s|%Y' "$file"`,
        'done',
      ].join('\n');

      const stdout = await this.runDockerHostShell(
        listCommand,
        DOCKER_LOG_MAX_BUFFER,
        logInfo.logPath,
      );

      return stdout
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => {
          const [name, size, modifiedAt] = line.split('|');
          const fullPath = `${directory}/${name}`;
          const isCurrent = name === basename;
          return {
            id: name,
            label: isCurrent ? '현재 json.log' : name,
            type: isCurrent ? 'current' : 'rotated',
            path: fullPath,
            size: parseInt(size, 10) || 0,
            modifiedAt: new Date((parseInt(modifiedAt, 10) || 0) * 1000)
              .toISOString(),
            compressed: name.endsWith('.gz'),
          } satisfies DockerLogArchiveSource;
        })
        .sort((left, right) => {
          if (left.type !== right.type) {
            return left.type === 'current' ? -1 : 1;
          }
          return (
            new Date(right.modifiedAt).getTime() -
            new Date(left.modifiedAt).getTime()
          );
        });
    } catch (error) {
      this.logger.error('Failed to list docker archive sources:', error.message);
      return [];
    }
  }

  createLogStream(options: DockerLogReadOptions): ChildProcessWithoutNullStreams {
    if (!options.containerId) {
      throw new Error('Container ID is required for docker stream');
    }

    const args = ['logs', '--tail', '0', '-f'];
    if (options.timestamps) {
      args.push('--timestamps');
    }
    if (options.since) {
      args.push('--since', this.sanitizeSince(options.since));
    }
    if (options.until) {
      args.push('--until', this.sanitizeSince(options.until));
    }

    args.push(this.sanitizeContainerId(options.containerId));
    return spawn('docker', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  }

  applyFilters(lines: string[], options: DockerLogReadOptions): string[] {
    if (!options.filter || options.filter === 'all') {
      return lines;
    }

    if (options.filter === 'errors') {
      return lines.filter((line) => this.matchesGenericError(line));
    }

    if (options.containerName !== 'kscold-nginx') {
      return lines;
    }

    if (options.filter === 'nginx-access') {
      return lines.filter((line) => NGINX_ACCESS_PATTERN.test(line));
    }

    if (options.filter === 'nginx-error') {
      return lines.filter((line) => NGINX_ERROR_PATTERN.test(line));
    }

    return lines;
  }

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

  private async inspectContainerLogFile(
    containerId: string,
  ): Promise<DockerLogFileInfo> {
    const normalizedId = this.sanitizeContainerId(containerId);
    const { stdout } = await execAsync(
      `docker inspect --format "{{.Name}}|{{.LogPath}}|{{.HostConfig.LogConfig.Type}}" ${normalizedId}`,
    );
    const [rawName, logPath, logType] = stdout.trim().split('|');
    return {
      containerId: normalizedId,
      containerName: rawName.replace(/^\//, ''),
      logPath,
      logType,
    };
  }

  private resolveTail(tail?: number | 'all'): string {
    return tail === 'all' ? 'all' : `${this.resolveNumericTail(tail)}`;
  }

  private resolveNumericTail(tail?: number | 'all'): number {
    if (typeof tail === 'number' && Number.isFinite(tail) && tail > 0) {
      return Math.floor(tail);
    }
    return 200;
  }

  private sanitizeContainerId(containerId: string): string {
    const normalized = containerId.trim();
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(normalized)) {
      throw new Error('Invalid container identifier');
    }
    return normalized;
  }

  private sanitizeSince(since: string): string {
    const normalized = since.trim();
    if (!/^[0-9A-Za-z:+\-_.TZ]+$/.test(normalized)) {
      throw new Error('Invalid since value');
    }
    return normalized;
  }

  private quoteShell(value: string): string {
    return `'${value.replace(/'/g, `'\\''`)}'`;
  }

  private async runDockerHostShell(
    command: string,
    maxBuffer: number,
    localPath?: string,
  ): Promise<string> {
    if (localPath && fs.existsSync(localPath)) {
      const { stdout } = await execAsync(`/bin/sh -lc ${this.quoteShell(command)}`, {
        maxBuffer,
      });
      return stdout;
    }

    const { stdout } = await execAsync(
      `colima ssh -- sudo sh -lc ${this.quoteShell(command)}`,
      { maxBuffer },
    );
    return stdout;
  }

  private formatArchiveJsonLine(
    rawLine: string,
    timestamps?: boolean,
  ): string | null {
    const normalized = rawLine.trim();
    if (!normalized) {
      return null;
    }

    try {
      const parsed = JSON.parse(normalized) as DockerJsonLogRecord;
      const message = parsed.log?.replace(/\n$/, '') ?? '';
      if (!message.trim()) {
        return null;
      }

      if (timestamps && parsed.time) {
        return `${parsed.time} ${message}`;
      }

      return message;
    } catch {
      return normalized;
    }
  }

  private resolveTimeRange(
    since?: string,
    until?: string,
  ): { since: number | null; until: number | null } | null {
    const parsedSince = this.resolveTimeThreshold(since);
    const parsedUntil = this.resolveTimeThreshold(until);
    if (parsedSince === null && parsedUntil === null) {
      return null;
    }

    return {
      since: parsedSince,
      until: parsedUntil,
    };
  }

  private resolveTimeThreshold(value?: string): number | null {
    if (!value) {
      return null;
    }

    const durationMatch = value.match(DURATION_PATTERN);
    if (durationMatch) {
      const amount = parseInt(durationMatch[1], 10);
      const unit = durationMatch[2].toLowerCase();
      const multiplier =
        unit === 's'
          ? 1000
          : unit === 'm'
            ? 60 * 1000
            : unit === 'h'
              ? 60 * 60 * 1000
              : 24 * 60 * 60 * 1000;
      return Date.now() - amount * multiplier;
    }

    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  private isWithinTimeRange(
    line: string,
    range: { since: number | null; until: number | null },
  ): boolean {
    const token = line.split(' ')[0];
    const parsed = Date.parse(token);
    if (Number.isNaN(parsed)) {
      return true;
    }

    if (range.since !== null && parsed < range.since) {
      return false;
    }

    if (range.until !== null && parsed > range.until) {
      return false;
    }

    return true;
  }

  private matchesGenericError(line: string): boolean {
    if (NGINX_ERROR_PATTERN.test(line)) {
      return true;
    }

    return GENERIC_ERROR_PATTERN.test(line);
  }
}
