import { Injectable, Logger } from '@nestjs/common';
import { execFile, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';
import {
  formatBackupTimestamp,
  isValidScheduledBackupTargetName,
  parseBackupTimestamp,
  selectExpiredBackups,
} from '../../domain/policies/scheduled-backup.policy';
import type { IExternalMongodbBackupRepository } from '../../domain/repositories/external-mongodb-backup.repository';
import type { MongodbBackupResult } from '../../domain/repositories/mongodb-backup.repository';
import type { ScheduledBackupTarget } from '../../domain/types/scheduled-backup.type';
import { MONGODB_BACKUP_ROOT } from './mongodb-backup-root';

const execFileAsync = promisify(execFile);

/** 백업 하나가 남기는 아카이브 파일 이름. 정리 대상을 가려낼 때도 이 파일의 유무를 본다. */
const ARCHIVE_FILE_NAME = 'dump.archive.gz';

/** 덤프가 끝나기 전의 파일을 두는 작업 디렉터리 이름 */
const PARTIAL_DIRECTORY_NAME = '.partial';

/** 컨테이너에 접속 URI 를 넘길 때 쓰는 환경변수 이름 */
const URI_ENV_KEY = 'MONGODB_BACKUP_URI';

const DUMP_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_STDERR_LENGTH = 8 * 1024;
const MAX_ERROR_DETAIL_LENGTH = 500;

/**
 * 컨테이너 안에서 실행할 덤프 스크립트.
 *
 * 접속 URI 를 mongodump 인자로 넘기면 프로세스 목록에 자격증명이 드러나므로,
 * 컨테이너 안 임시 설정 파일에 적어 --config 로 전달한다.
 * 아카이브는 표준 출력으로 내보내 호스트가 파일로 받는다.
 */
const DUMP_SCRIPT = [
  'set -e',
  'umask 077',
  'config=$(mktemp)',
  `trap 'rm -f "$config"' EXIT`,
  `printf 'uri: "%s"\\n' "$${URI_ENV_KEY}" > "$config"`,
  'mongodump --config "$config" --archive --gzip --quiet',
].join('\n');

/**
 * 외부 MongoDB 를 일회용 컨테이너의 mongodump 로 덤프한다.
 *
 * 호스트에 MongoDB 도구를 설치하지 않아도 되고, 접속 URI 는 docker 명령 인자가 아니라
 * 환경변수로만 전달되어 호스트 프로세스 목록에 남지 않는다.
 */
@Injectable()
export class DockerExternalMongodbBackupRepository implements IExternalMongodbBackupRepository {
  private readonly logger = new Logger(
    DockerExternalMongodbBackupRepository.name,
  );

  protected readonly backupRoot: string = MONGODB_BACKUP_ROOT;
  protected readonly dockerBinary: string = 'docker';

  async create(target: ScheduledBackupTarget): Promise<MongodbBackupResult> {
    this.assertSafeTargetName(target.name);

    const timestamp = formatBackupTimestamp(new Date());
    const targetDir = path.join(this.backupRoot, target.name);
    const backupDir = path.join(targetDir, timestamp);
    const partialDir = path.join(
      this.backupRoot,
      PARTIAL_DIRECTORY_NAME,
      `${target.name}_${timestamp}`,
    );

    this.removeStalePartials(target.name);
    fs.mkdirSync(targetDir, { recursive: true, mode: 0o700 });
    fs.mkdirSync(partialDir, { recursive: true, mode: 0o700 });

    try {
      await this.dump(
        target,
        path.join(partialDir, ARCHIVE_FILE_NAME),
        `mongodb-backup-${target.name}-${timestamp}`,
      );
      // 덤프가 끝난 뒤에만 백업 목록에 나타나도록 완성본을 한 번에 옮긴다.
      fs.renameSync(partialDir, backupDir);
    } catch (error) {
      fs.rmSync(partialDir, { recursive: true, force: true });
      throw error;
    }

    return { path: backupDir, size: await this.measure(backupDir) };
  }

  async prune(targetName: string, retentionDays: number): Promise<string[]> {
    this.assertSafeTargetName(targetName);

    const targetDir = path.join(this.backupRoot, targetName);
    if (!fs.existsSync(targetDir)) {
      return [];
    }

    // 이 저장소가 만든 백업(아카이브 파일이 든 디렉터리)만 정리 대상으로 삼는다.
    // 같은 이름의 컨테이너를 수동 백업한 디렉터리가 섞여 있어도 지우지 않는다.
    const names = fs
      .readdirSync(targetDir, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isDirectory() &&
          fs.existsSync(path.join(targetDir, entry.name, ARCHIVE_FILE_NAME)),
      )
      .map((entry) => entry.name);

    const expired = selectExpiredBackups(names, retentionDays, new Date());
    for (const name of expired) {
      fs.rmSync(path.join(targetDir, name), { recursive: true, force: true });
      this.logger.log(`보관 기간이 지난 백업 삭제: ${targetName}/${name}`);
    }

    return expired;
  }

  private dump(
    target: ScheduledBackupTarget,
    outputPath: string,
    containerName: string,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(outputPath, { mode: 0o600 });
      const child = spawn(
        this.dockerBinary,
        [
          'run',
          '--rm',
          '--name',
          containerName,
          // 값 없이 이름만 주면 docker 가 자기 환경에서 읽어 컨테이너로 넘긴다.
          '-e',
          URI_ENV_KEY,
          '--entrypoint',
          'sh',
          target.image,
          '-c',
          DUMP_SCRIPT,
        ],
        {
          env: { ...process.env, [URI_ENV_KEY]: target.uri },
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );

      let settled = false;
      let stderr = '';
      let exitCode: number | null = null;
      let processClosed = false;
      let outputClosed = false;

      const fail = (message: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        child.kill('SIGKILL');
        output.destroy();
        reject(new Error(message));
      };

      const settleWhenDone = () => {
        if (settled || !processClosed || !outputClosed) return;
        if (exitCode !== 0) {
          const detail = redactSecrets(stderr, target.uri).slice(
            0,
            MAX_ERROR_DETAIL_LENGTH,
          );
          fail(`mongodump 가 실패했습니다 (exit=${exitCode}): ${detail}`);
          return;
        }
        if (output.bytesWritten === 0) {
          fail('덤프 결과가 비어 있습니다.');
          return;
        }
        settled = true;
        clearTimeout(timer);
        resolve();
      };

      const timer = setTimeout(() => {
        // docker 명령만 죽이면 컨테이너는 계속 돌기 때문에 컨테이너도 함께 치운다.
        this.removeContainer(containerName);
        fail(
          `덤프가 ${DUMP_TIMEOUT_MS / 60_000}분 안에 끝나지 않아 중단했습니다.`,
        );
      }, DUMP_TIMEOUT_MS);

      child.stderr.on('data', (chunk: Buffer) => {
        if (stderr.length < MAX_STDERR_LENGTH) {
          stderr += chunk.toString('utf8');
        }
      });
      child.stdout.pipe(output);

      child.once('error', (error) => {
        fail(`docker 를 실행하지 못했습니다: ${error.message}`);
      });
      child.once('close', (code) => {
        exitCode = code;
        processClosed = true;
        settleWhenDone();
      });
      output.once('error', (error) => {
        fail(`백업 파일을 쓰지 못했습니다: ${error.message}`);
      });
      output.once('close', () => {
        outputClosed = true;
        settleWhenDone();
      });
    });
  }

  /** 이전 실행이 중간에 끊겨 남은 작업 디렉터리를 치운다. */
  private removeStalePartials(targetName: string): void {
    const partialRoot = path.join(this.backupRoot, PARTIAL_DIRECTORY_NAME);
    if (!fs.existsSync(partialRoot)) {
      return;
    }

    const prefix = `${targetName}_`;
    for (const entry of fs.readdirSync(partialRoot, { withFileTypes: true })) {
      // 이름이 `a` 인 대상이 `a_b` 대상의 작업 디렉터리를 지우지 않도록 뒤쪽이 시각 형식인지 확인한다.
      if (
        entry.isDirectory() &&
        entry.name.startsWith(prefix) &&
        parseBackupTimestamp(entry.name.slice(prefix.length)) !== null
      ) {
        fs.rmSync(path.join(partialRoot, entry.name), {
          recursive: true,
          force: true,
        });
      }
    }
  }

  private removeContainer(containerName: string): void {
    execFile(this.dockerBinary, ['rm', '-f', containerName], () => undefined);
  }

  private async measure(directory: string): Promise<string> {
    try {
      const { stdout } = await execFileAsync('du', ['-sh', directory]);
      return stdout.trim().split(/\s+/)[0] ?? '-';
    } catch {
      // 크기를 재지 못했다고 해서 멀쩡한 백업을 실패로 처리하지 않는다.
      return '-';
    }
  }

  /** 대상 이름이 디렉터리·컨테이너 이름에 그대로 들어가므로 형식을 제한한다. */
  private assertSafeTargetName(targetName: string): void {
    if (!isValidScheduledBackupTargetName(targetName)) {
      throw new Error(`허용되지 않은 예약 백업 대상 이름입니다: ${targetName}`);
    }
  }
}

/** 오류 메시지에 섞여 나온 접속 URI 와 자격증명을 가린다. */
function redactSecrets(text: string, uri: string): string {
  const secrets = new Set<string>([uri]);

  const credentials = /^mongodb(?:\+srv)?:\/\/([^@/]+)@/.exec(uri)?.[1];
  if (credentials) {
    secrets.add(credentials);
    const separator = credentials.indexOf(':');
    if (separator >= 0) {
      const password = credentials.slice(separator + 1);
      secrets.add(password);
      try {
        secrets.add(decodeURIComponent(password));
      } catch {
        // 퍼센트 인코딩이 아닌 비밀번호면 원문만 가린다.
      }
    }
  }

  let redacted = text;
  for (const secret of secrets) {
    if (secret.length >= 4) {
      redacted = redacted.split(secret).join('***');
    }
  }

  // 도구가 URI 를 다른 형태로 다시 써서 출력해도 자격증명 부분은 남기지 않는다.
  return redacted
    .replace(/(mongodb(?:\+srv)?:\/\/)[^@\s/]+@/g, '$1***@')
    .trim();
}
