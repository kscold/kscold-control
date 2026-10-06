import { Logger } from '@nestjs/common';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { formatBackupTimestamp } from '@/system/domain/policies/scheduled-backup.policy';
import type { ScheduledBackupTarget } from '@/system/domain/types/scheduled-backup.type';
import { DockerExternalMongodbBackupRepository } from '@/system/infrastructure/repositories/docker-external-mongodb-backup.repository';

/**
 * 실제 docker 대신 쓰는 가짜 실행 파일.
 * 받은 인자와 환경변수를 파일로 남겨 테스트가 확인할 수 있게 하고, 모드에 따라 성공·실패를 흉내 낸다.
 */
const FAKE_DOCKER_SCRIPT = `#!/bin/sh
printf '%s\\n' "$@" > "$FAKE_DOCKER_LOG_DIR/args"
printf '%s' "$MONGODB_BACKUP_URI" > "$FAKE_DOCKER_LOG_DIR/uri"
case "$FAKE_DOCKER_MODE" in
  fail)
    echo "Failed: can't create session: could not connect to $MONGODB_BACKUP_URI" >&2
    exit 1
    ;;
  empty)
    exit 0
    ;;
  *)
    printf 'archive-bytes'
    ;;
esac
`;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

describe('DockerExternalMongodbBackupRepository', () => {
  const target: ScheduledBackupTarget = {
    name: 'app-prod',
    uri: 'mongodb+srv://backup:secret-pass@cluster.example.net/prod',
    retentionDays: 10,
    image: 'mongo:7',
  };

  let workDir: string;
  let backupRoot: string;
  let logDir: string;
  let fakeDocker: string;

  function createRepository(dockerBinary = fakeDocker) {
    const root = backupRoot;
    return new (class extends DockerExternalMongodbBackupRepository {
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

  function seedBackup(daysAgo: number, withArchive = true): string {
    const name = formatBackupTimestamp(
      new Date(Date.now() - daysAgo * DAY_IN_MS),
    );
    const directory = path.join(backupRoot, target.name, name);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(
      path.join(directory, withArchive ? 'dump.archive.gz' : 'dump.bson'),
      'x',
    );
    return name;
  }

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scheduled-backup-'));
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
      expect(result.size).not.toBe('');

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
      expect(args.split('\n').slice(0, 9)).toEqual([
        'run',
        '--rm',
        '--name',
        expect.stringMatching(/^mongodb-backup-app-prod-\d{4}-/),
        '-e',
        'MONGODB_BACKUP_URI',
        '--entrypoint',
        'sh',
        'mongo:7',
      ]);
      expect(args).toContain('mongodump --config "$config" --archive --gzip');
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
      expect(message).toContain('could not connect');
      expect(message).not.toContain('secret-pass');
      expect(message).not.toContain(target.uri);
      expect(backupNames()).toEqual([]);
      expect(fs.readdirSync(path.join(backupRoot, '.partial'))).toEqual([]);
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
      ).rejects.toThrow('허용되지 않은 예약 백업 대상 이름');
      expect(fs.existsSync(path.join(logDir, 'args'))).toBe(false);
    });
  });

  describe('prune', () => {
    it('보관 기간이 지난 예약 백업만 지운다', async () => {
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
        '허용되지 않은 예약 백업 대상 이름',
      );
    });
  });
});
