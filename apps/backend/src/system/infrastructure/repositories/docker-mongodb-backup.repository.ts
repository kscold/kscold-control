import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { getHomeDirectory } from '../../../common/utils';
import type {
  IMongodbBackupRepository,
  MongodbBackupEntry,
  MongodbBackupResult,
} from '../../domain/repositories/mongodb-backup.repository';

const execFileAsync = promisify(execFile);
const BACKUP_ROOT = path.join(
  getHomeDirectory(),
  'Desktop',
  'server-logs',
  'mongodb-backups',
);
const DOCKER_HOST =
  process.env.DOCKER_HOST || 'unix:///Users/kscold/.colima/default/docker.sock';

/** 컨테이너 안에서 MongoDB 접속 정보를 찾을 때 확인하는 환경변수 이름들 */
const MONGO_URI_ENV_KEYS = ['MONGODB_URI', 'MONGO_URI', 'MONGO_URL'];

/** 백업 대상 컨테이너 이름 형식 (명령어 주입 방지) */
const SAFE_CONTAINER_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;

@Injectable()
export class DockerMongodbBackupRepository implements IMongodbBackupRepository {
  private readonly logger = new Logger(DockerMongodbBackupRepository.name);

  async create(containerName: string): Promise<MongodbBackupResult> {
    this.assertSafeContainerName(containerName);

    const date = new Date()
      .toISOString()
      .replace(/T/, '_')
      .replace(/:/g, '-')
      .slice(0, 19);
    const backupDir = path.join(BACKUP_ROOT, containerName, date);
    const dumpName = `dump_${date}`;
    const env = { ...process.env, DOCKER_HOST };

    fs.mkdirSync(backupDir, { recursive: true });
    this.logger.log(`백업 시작: ${containerName} → ${backupDir}`);

    // 접속 정보 조회와 덤프를 컨테이너 안 같은 셸에서 수행한다.
    // - 백업 대상마다 DB 이름과 계정이 다르므로 코드에 특정 값을 박으면 다른 컨테이너에서 실패한다.
    //   (과거 `--db kscold-blog` 하드코딩 + 인증 누락으로 백업이 동작하지 않았다)
    // - 자격증명을 호스트로 가져오면 docker 명령 인자에 노출되므로 컨테이너 밖으로 내보내지 않는다.
    await execFileAsync(
      'docker',
      [
        'exec',
        containerName,
        'sh',
        '-c',
        this.buildDumpScript(`/tmp/${dumpName}`),
      ],
      { env },
    );

    await execFileAsync(
      'docker',
      ['cp', `${containerName}:/tmp/${dumpName}`, `${backupDir}/`],
      { env },
    );
    await execFileAsync(
      'docker',
      ['exec', containerName, 'rm', '-rf', `/tmp/${dumpName}`],
      { env },
    ).catch(() => undefined);

    const { stdout } = await execFileAsync('du', ['-sh', backupDir]);
    const size = stdout.trim().split(/\s+/)[0] ?? '-';
    this.logger.log(`백업 완료: ${backupDir} (${size})`);
    return { path: backupDir, size };
  }

  async list(containerName: string): Promise<MongodbBackupEntry[]> {
    this.assertSafeContainerName(containerName);

    const containerDir = path.join(BACKUP_ROOT, containerName);
    if (!fs.existsSync(containerDir)) {
      return [];
    }

    return Promise.all(
      fs
        .readdirSync(containerDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .sort((left, right) => right.name.localeCompare(left.name))
        .map(async (entry) => {
          const backupPath = path.join(containerDir, entry.name);
          let size = '-';
          try {
            const { stdout } = await execFileAsync('du', ['-sh', backupPath]);
            size = stdout.trim().split(/\s+/)[0] ?? '-';
          } catch {
            // 크기 조회에 실패했다고 해서 멀쩡한 백업을 목록에서 빠뜨려선 안 된다.
          }
          return { date: entry.name, path: backupPath, size };
        }),
    );
  }

  /**
   * 컨테이너 안에서 실행할 덤프 스크립트를 만든다.
   *
   * 앱이 실제로 쓰는 접속 URI 를 그대로 사용하므로 DB 이름·계정·authSource 가
   * 한 번에 해결되고, 백업 대상이 늘어나도 이 코드를 고칠 필요가 없다.
   * 앱이 .env 를 셸에서 읽어 export 하는 구성이 있어 컨테이너 기본 환경변수만으로는
   * 자격증명이 보이지 않으므로, 실행 중인 프로세스의 환경변수를 먼저 확인한다.
   */
  private buildDumpScript(outDir: string): string {
    const keyPattern = MONGO_URI_ENV_KEYS.join('|');

    return [
      'set -e',
      // 실행 중인 모든 프로세스와 컨테이너 기본 환경에서 접속 URI 후보를 모은다.
      'candidates=$(',
      '  { for p in /proc/[0-9]*; do',
      `      tr '\\0' '\\n' < "$p/environ" 2>/dev/null | grep -E '^(${keyPattern})=mongodb' || true`,
      '    done',
      `    env | grep -E '^(${keyPattern})=mongodb' || true`,
      '  } | sed "s/^[^=]*=//" | sort -u',
      ')',
      // 같은 컨테이너에 자격증명이 있는 URI 와 없는 URI 가 함께 존재할 수 있다.
      // (예: PM2 데몬은 자격증명 없는 값을, 앱 프로세스는 .env 에서 읽은 실제 값을 가진다)
      // 인증이 켜진 MongoDB 에서는 자격증명 없는 URI 로 덤프가 실패하므로
      // "user:pass@" 형태가 포함된 URI 를 우선한다.
      'uri=$(echo "$candidates" | grep "@" | head -1 || true)',
      'if [ -z "$uri" ]; then uri=$(echo "$candidates" | head -1 || true); fi',
      'if [ -z "$uri" ]; then',
      `  echo "MongoDB 접속 정보를 찾지 못했습니다 (${MONGO_URI_ENV_KEYS.join(', ')})" >&2`,
      '  exit 1',
      'fi',
      `mongodump --uri "$uri" --out ${outDir} --quiet`,
    ].join('\n');
  }

  /** 컨테이너 이름이 셸 명령에 그대로 들어가므로 형식을 제한한다. */
  private assertSafeContainerName(containerName: string): void {
    if (!SAFE_CONTAINER_NAME.test(containerName)) {
      throw new Error(`허용되지 않은 컨테이너 이름입니다: ${containerName}`);
    }
  }
}
