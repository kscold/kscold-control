import { Logger } from '@nestjs/common';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { formatBackupTimestamp } from '@/backup/domain/policies/backup-retention.policy';
import type { BackupDumpRequest } from '@/backup/domain/types/backup.type';
import { DockerMongodbArchiveRepository } from '@/backup/infrastructure/repositories/docker-mongodb-archive.repository';

/**
 * 실제 docker 대신 쓰는 가짜 실행 파일.
 * 받은 인자와 환경변수를 파일로 남겨 테스트가 확인할 수 있게 하고, 모드에 따라 성공·실패를 흉내 낸다.
 */
const FAKE_DOCKER_SCRIPT = `#!/bin/sh
printf '%s\\n' "$@" > "$FAKE_DOCKER_LOG_DIR/args"
printf '%s' "$MONGODB_BACKUP_URI" > "$FAKE_DOCKER_LOG_DIR/uri"
case "$FAKE_DOCKER_MODE" in
  fail)
    printf '2026-10-06T06:50:01.000+0000\\twriting prod.users to archive on stdout\\n' >&2
    printf "2026-10-06T06:50:07.033+0000\\tFailed: can't create session: could not connect to %s\\n" "$MONGODB_BACKUP_URI" >&2
    exit 1
    ;;
  noisy-fail)
    i=0
    while [ "$i" -lt 400 ]; do
      echo "2026-10-06T06:50:01.000+0000	writing prod.collection_$i to archive on stdout" >&2
      i=$((i + 1))
    done
    echo "2026-10-06T06:50:09.000+0000	Failed: error writing data for collection: connection reset" >&2
    exit 1
    ;;
  unknown-fail)
    echo "something unexpected happened" >&2
    echo "container runtime error" >&2
    exit 2
    ;;
  empty)
    exit 0
    ;;
  killed)
    exit 137
    ;;
  *)
    printf 'archive-bytes'
    ;;
esac
`;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

describe('DockerMongodbArchiveRepository', () => {
  const target: BackupDumpRequest = {
    name: 'app-prod',
    uri: 'mongodb+srv://backup:secret-pass@cluster.example.net/prod',
    image: 'mongo:7',
  };

  let workDir: string;
  let backupRoot: string;
  let logDir: string;
  let fakeDocker: string;

  function createRepository(dockerBinary = fakeDocker) {
    const root = backupRoot;
    return new (class extends DockerMongodbArchiveRepository {
      protected readonly backupRoot = root;
      protected readonly dockerBinary = dockerBinary;
    })();
  }

  function backupNames(): string[] {
    const targetDir = path.join(backupRoot, target.name);
    return fs.existsSync(targetDir)
      ? fs
          .readdirSync(targetDir, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name)
      : [];
  }

  function seedBackup(
    daysAgo: number,
    withArchive = true,
    contents = 'x',
  ): string {
    const name = formatBackupTimestamp(
      new Date(Date.now() - daysAgo * DAY_IN_MS),
    );
    const directory = path.join(backupRoot, target.name, name);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(
      path.join(directory, withArchive ? 'dump.archive.gz' : 'dump.bson'),
      contents,
    );
    return name;
  }

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-archive-'));
    backupRoot = path.join(workDir, 'backups');
    logDir = path.join(workDir, 'log');
    fakeDocker = path.join(workDir, 'fake-docker');
    fs.mkdirSync(logDir);
    fs.writeFileSync(fakeDocker, FAKE_DOCKER_SCRIPT, { mode: 0o755 });

    process.env.FAKE_DOCKER_LOG_DIR = logDir;
    delete process.env.FAKE_DOCKER_MODE;
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    delete process.env.FAKE_DOCKER_LOG_DIR;
    delete process.env.FAKE_DOCKER_MODE;
    jest.restoreAllMocks();
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  describe('create', () => {
    it('아카이브를 대상 디렉터리의 시각 폴더에 저장한다', async () => {
      const result = await createRepository().create(target);

      const [name] = backupNames();
      expect(name).toMatch(/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/);
      expect(result.path).toBe(path.join(backupRoot, target.name, name));
      // 크기는 아카이브 파일의 바이트 수다.
      expect(result.sizeBytes).toBe('archive-bytes'.length);

      const archive = path.join(result.path, 'dump.archive.gz');
      expect(fs.readFileSync(archive, 'utf8')).toBe('archive-bytes');
      // 운영 데이터가 담기므로 소유자만 읽을 수 있어야 한다.
      expect(fs.statSync(archive).mode & 0o777).toBe(0o600);
      expect(fs.readdirSync(path.join(backupRoot, '.partial'))).toEqual([]);
    });

    it('접속 URI 를 docker 인자가 아니라 환경변수로만 넘긴다', async () => {
      await createRepository().create(target);

      const args = fs.readFileSync(path.join(logDir, 'args'), 'utf8');
      expect(args).not.toContain('secret-pass');
      expect(args).not.toContain('cluster.example.net');
      expect(args.split('\n').slice(0, 11)).toEqual([
        'run',
        '--rm',
        '--name',
        expect.stringMatching(/^mongodb-backup-app-prod-\d{4}-/),
        // 같은 서버의 DB 에 host.docker.internal 로 닿을 수 있게 한다.
        '--add-host',
        'host.docker.internal:host-gateway',
        '-e',
        'MONGODB_BACKUP_URI',
        '--entrypoint',
        'sh',
        'mongo:7',
      ]);
      expect(args).toContain('mongodump --config "$config" --archive --gzip');
      // --quiet 는 실패 사유까지 지우므로 쓰지 않는다.
      expect(args).not.toContain('--quiet');
      expect(fs.readFileSync(path.join(logDir, 'uri'), 'utf8')).toBe(
        target.uri,
      );
    });

    it('덤프가 실패하면 미완성 파일을 남기지 않고 자격증명을 가린 오류를 낸다', async () => {
      process.env.FAKE_DOCKER_MODE = 'fail';

      const error = await createRepository()
        .create(target)
        .catch((caught: Error) => caught);

      expect(error).toBeInstanceOf(Error);
      const message = (error as Error).message;
      expect(message).toContain('exit=1');
      expect(message).toContain("Failed: can't create session");
      expect(message).toContain('could not connect');
      // 진행 로그와 시각은 빼고 실패 사유만 남긴다.
      expect(message).not.toContain('writing prod.users');
      expect(message).not.toContain('2026-10-06T06:50');
      expect(message).not.toContain('secret-pass');
      expect(message).not.toContain(target.uri);
      expect(backupNames()).toEqual([]);
      expect(fs.readdirSync(path.join(backupRoot, '.partial'))).toEqual([]);
    });

    it('진행 로그가 길어도 마지막에 나온 실패 사유를 놓치지 않는다', async () => {
      process.env.FAKE_DOCKER_MODE = 'noisy-fail';

      await expect(createRepository().create(target)).rejects.toThrow(
        'mongodump 가 실패했습니다 (exit=1): Failed: error writing data for collection: connection reset',
      );
    });

    it('실패 사유 줄이 없으면 마지막 출력을 그대로 보여준다', async () => {
      process.env.FAKE_DOCKER_MODE = 'unknown-fail';

      await expect(createRepository().create(target)).rejects.toThrow(
        'mongodump 가 실패했습니다 (exit=2): something unexpected happened / container runtime error',
      );
    });

    it('아무 출력 없이 끝난 실패도 읽을 수 있는 문구로 알린다', async () => {
      process.env.FAKE_DOCKER_MODE = 'killed';

      await expect(createRepository().create(target)).rejects.toThrow(
        'mongodump 가 출력 없이 끝났습니다 (exit=137)',
      );
      expect(backupNames()).toEqual([]);
    });

    it('빈 덤프는 실패로 처리한다', async () => {
      process.env.FAKE_DOCKER_MODE = 'empty';

      await expect(createRepository().create(target)).rejects.toThrow(
        '덤프 결과가 비어 있습니다.',
      );
      expect(backupNames()).toEqual([]);
    });

    it('docker 를 실행할 수 없으면 실패한다', async () => {
      const repository = createRepository(path.join(workDir, 'no-docker'));

      await expect(repository.create(target)).rejects.toThrow(
        'docker 를 실행하지 못했습니다',
      );
      expect(backupNames()).toEqual([]);
    });

    it('이전 실행이 남긴 같은 대상의 작업 디렉터리만 치운다', async () => {
      const partialRoot = path.join(backupRoot, '.partial');
      const stale = path.join(partialRoot, 'app-prod_2026-01-01_00-00-00');
      const otherTarget = path.join(
        partialRoot,
        'app-prod_replica_2026-01-01_00-00-00',
      );
      fs.mkdirSync(stale, { recursive: true });
      fs.mkdirSync(otherTarget, { recursive: true });

      await createRepository().create(target);

      expect(fs.existsSync(stale)).toBe(false);
      expect(fs.existsSync(otherTarget)).toBe(true);
    });

    it('허용되지 않은 대상 이름은 거부한다', async () => {
      await expect(
        createRepository().create({ ...target, name: '../escape' }),
      ).rejects.toThrow('허용되지 않은 백업 대상 이름');
      expect(fs.existsSync(path.join(logDir, 'args'))).toBe(false);
    });
  });

  describe('list', () => {
    it('보관 중인 백업을 최근 것부터 시각·크기와 함께 돌려준다', async () => {
      const older = seedBackup(3, true, 'older-archive');
      const newer = seedBackup(1, true, 'new');

      const archives = await createRepository().list(target.name);

      expect(archives.map((archive) => archive.name)).toEqual([newer, older]);
      expect(archives[0]).toEqual({
        name: newer,
        takenAt: expect.any(Date),
        path: path.join(backupRoot, target.name, newer),
        sizeBytes: 'new'.length,
      });
      expect(archives[1].sizeBytes).toBe('older-archive'.length);
    });

    it('아카이브가 없는 디렉터리와 형식이 다른 이름은 목록에 넣지 않는다', async () => {
      const scheduled = seedBackup(1);
      seedBackup(2, false);
      const stray = path.join(backupRoot, target.name, 'dump_old');
      fs.mkdirSync(stray, { recursive: true });
      fs.writeFileSync(path.join(stray, 'dump.archive.gz'), 'x');
      fs.writeFileSync(
        path.join(backupRoot, target.name, 'last-run.json'),
        '{}',
      );

      const archives = await createRepository().list(target.name);

      expect(archives.map((archive) => archive.name)).toEqual([scheduled]);
    });

    it('백업 디렉터리가 없으면 빈 목록을 돌려준다', async () => {
      await expect(createRepository().list(target.name)).resolves.toEqual([]);
    });

    it('허용되지 않은 대상 이름은 거부한다', async () => {
      await expect(createRepository().list('../escape')).rejects.toThrow(
        '허용되지 않은 백업 대상 이름',
      );
    });
  });

  describe('prune', () => {
    it('보관 기간이 지난 백업만 지운다', async () => {
      const recent = seedBackup(1);
      const withinRetention = seedBackup(9);
      const expired = seedBackup(11);
      const veryOld = seedBackup(40);
      fs.writeFileSync(
        path.join(backupRoot, target.name, 'last-run.json'),
        '{}',
      );

      const pruned = await createRepository().prune(target.name, 10);

      expect(pruned.sort()).toEqual([expired, veryOld].sort());
      expect(backupNames().sort()).toEqual([recent, withinRetention].sort());
      expect(
        fs.existsSync(path.join(backupRoot, target.name, 'last-run.json')),
      ).toBe(true);
    });

    it('아카이브가 없는 디렉터리(컨테이너 수동 백업)는 오래돼도 지우지 않는다', async () => {
      seedBackup(1);
      const manualBackup = seedBackup(40, false);

      const pruned = await createRepository().prune(target.name, 10);

      expect(pruned).toEqual([]);
      expect(backupNames()).toContain(manualBackup);
    });

    it('백업이 하나뿐이면 보관 기간이 지났어도 남긴다', async () => {
      const onlyBackup = seedBackup(40);

      await expect(createRepository().prune(target.name, 10)).resolves.toEqual(
        [],
      );
      expect(backupNames()).toEqual([onlyBackup]);
    });

    it('백업 디렉터리가 없으면 아무것도 하지 않는다', async () => {
      await expect(createRepository().prune(target.name, 10)).resolves.toEqual(
        [],
      );
    });

    it('허용되지 않은 대상 이름은 거부한다', async () => {
      await expect(createRepository().prune('../escape', 10)).rejects.toThrow(
        '허용되지 않은 백업 대상 이름',
      );
    });
  });
});
