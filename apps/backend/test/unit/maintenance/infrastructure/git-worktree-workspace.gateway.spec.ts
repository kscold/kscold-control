import { Logger } from '@nestjs/common';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { GitWorktreeWorkspaceGateway } from '@/maintenance/infrastructure/gateways/git-worktree-workspace.gateway';
import type { WorktreeInspection } from '@/maintenance/domain/types/worktree.type';

/**
 * 실제 git 저장소와 작업 폴더를 임시 디렉터리에 만들어 확인한다.
 * 원격은 같은 임시 디렉터리 안의 bare 저장소라 네트워크를 쓰지 않는다.
 */
describe('GitWorktreeWorkspaceGateway', () => {
  // 실제 git 저장소·작업 폴더를 여러 개 만들어 보는 테스트라 기계가 바쁘면 기본 5초를 넘긴다
  jest.setTimeout(30_000);

  let work: string;
  let repo: string;
  let root: string;
  let backups: string;

  const git = (cwd: string, ...args: string[]) =>
    execFileSync('git', ['-C', cwd, ...args], {
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 't',
        GIT_AUTHOR_EMAIL: 't@example.com',
        GIT_COMMITTER_NAME: 't',
        GIT_COMMITTER_EMAIL: 't@example.com',
      },
    });

  function gateway() {
    const backupRoot = backups;
    return new (class extends GitWorktreeWorkspaceGateway {
      protected readonly backupRoot = backupRoot;
    })();
  }

  function addWorktree(name: string, branch: string) {
    git(
      repo,
      'worktree',
      'add',
      '-q',
      '-b',
      branch,
      path.join(root, name),
      'origin/dev',
    );
    return path.join(root, name);
  }

  function commit(dir: string, file: string) {
    fs.writeFileSync(path.join(dir, file), file);
    git(dir, 'add', file);
    git(dir, 'commit', '-q', '-m', file);
  }

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  beforeEach(() => {
    work = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'worktree-cleanup-')),
    );
    const origin = path.join(work, 'origin.git');
    repo = path.join(work, 'repo');
    root = path.join(work, 'worktrees');
    backups = path.join(work, 'backups');
    fs.mkdirSync(root);
    execFileSync('git', ['init', '-q', '--bare', '-b', 'dev', origin]);
    execFileSync('git', ['init', '-q', '-b', 'dev', repo]);
    fs.writeFileSync(path.join(repo, '.gitignore'), '.env\nnode_modules/\n');
    git(repo, 'add', '.gitignore');
    git(repo, 'commit', '-q', '-m', 'init');
    git(repo, 'remote', 'add', 'origin', origin);
    git(repo, 'push', '-q', 'origin', 'dev');
    git(repo, 'fetch', '-q', 'origin');
  });

  afterEach(() => {
    fs.rmSync(work, { recursive: true, force: true });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('작업 폴더마다 병합·푸시·변경 상태를 정확히 읽는다', async () => {
    // 병합 완료: dev 에 들어간 커밋만 있다
    const merged = addWorktree('merged', 'feature/merged');
    commit(merged, 'a.txt');
    git(merged, 'push', '-q', 'origin', 'feature/merged:dev');
    // 원격에 올렸지만 dev 에는 아직 안 들어갔다
    const pushed = addWorktree('pushed', 'feature/pushed');
    commit(pushed, 'b.txt');
    git(pushed, 'push', '-q', 'origin', 'feature/pushed');
    // 로컬에만 있는 커밋
    const local = addWorktree('local', 'feature/local');
    commit(local, 'c.txt');
    // 커밋하지 않은 새 파일
    const dirty = addWorktree('dirty', 'feature/dirty');
    fs.writeFileSync(path.join(dirty, 'draft.txt'), 'x');
    // 무시되는 파일만 있는 폴더는 깨끗하다
    fs.writeFileSync(path.join(merged, '.env'), 'SECRET=1');
    // 작업 폴더가 아닌 디렉터리
    fs.mkdirSync(path.join(root, 'not-a-worktree'));

    const result = await gateway().scan(root, ['origin/dev']);
    const byName = Object.fromEntries(
      result.inspections.map((i) => [i.name, i]),
    );

    expect(result.staleRepositories).toEqual([]);
    expect(byName.merged).toMatchObject({
      merged: true,
      unpushedCount: 0,
      uncommittedCount: 0,
      branch: 'feature/merged',
      repositoryPath: repo,
    });
    expect(byName.pushed).toMatchObject({
      merged: false,
      unpushedCount: 0,
      uncommittedCount: 0,
    });
    expect(byName.local).toMatchObject({ unpushedCount: 1 });
    expect(byName.dirty).toMatchObject({ uncommittedCount: 1 });
    expect(byName.merged.sizeBytes).toBeGreaterThan(0);
    expect(result.failures.map((f) => f.name)).toEqual(['not-a-worktree']);
  });

  it('지우기 전에 무시되는 로컬 파일을 남기고, 원본 저장소와 브랜치는 그대로 둔다', async () => {
    const dir = addWorktree('done', 'feature/done');
    commit(dir, 'a.txt');
    git(dir, 'push', '-q', 'origin', 'feature/done:dev');
    fs.writeFileSync(path.join(dir, '.env'), 'SECRET=1');
    fs.mkdirSync(path.join(dir, 'node_modules'));
    fs.writeFileSync(path.join(dir, 'node_modules', 'big.js'), 'x');

    const gw = gateway();
    const { inspections } = await gw.scan(root, ['origin/dev']);
    const removed = await gw.remove({
      targetName: 'test',
      inspection: inspections[0],
      baseRefs: ['origin/dev'],
    });

    expect(fs.existsSync(dir)).toBe(false);
    expect(git(repo, 'worktree', 'list')).not.toContain(dir);
    expect(git(repo, 'branch', '--list', 'feature/done')).toContain(
      'feature/done',
    );
    expect(
      fs.readFileSync(path.join(removed.backupPath, 'files', '.env'), 'utf8'),
    ).toBe('SECRET=1');
    // 다시 설치하면 되는 디렉터리는 남기지 않는다
    expect(
      fs.existsSync(path.join(removed.backupPath, 'files', 'node_modules')),
    ).toBe(false);
    const manifest = JSON.parse(
      fs.readFileSync(path.join(removed.backupPath, 'manifest.json'), 'utf8'),
    );
    expect(manifest).toMatchObject({
      branch: 'feature/done',
      savedFiles: ['.env'],
      skippedLocalEntries: ['node_modules/'],
    });
    expect(manifest.restore).toContain(`worktree add '${dir}' 'feature/done'`);
  });

  it('살펴본 뒤 변경이 생기면 지우지 않는다', async () => {
    const dir = addWorktree('changed', 'feature/changed');
    const gw = gateway();
    const { inspections } = await gw.scan(root, ['origin/dev']);
    fs.writeFileSync(path.join(dir, 'late.txt'), 'x');

    await expect(
      gw.remove({
        targetName: 'test',
        inspection: inspections[0],
        baseRefs: ['origin/dev'],
      }),
    ).rejects.toThrow('커밋하지 않은 변경');
    expect(fs.existsSync(dir)).toBe(true);
  });

  it('살펴본 뒤 새 커밋이 생기면 지우지 않는다', async () => {
    const dir = addWorktree('moved', 'feature/moved');
    const gw = gateway();
    const { inspections } = await gw.scan(root, ['origin/dev']);
    commit(dir, 'new.txt');
    git(dir, 'push', '-q', 'origin', 'feature/moved');

    await expect(
      gw.remove({
        targetName: 'test',
        inspection: inspections[0] as WorktreeInspection,
        baseRefs: ['origin/dev'],
      }),
    ).rejects.toThrow('새 커밋');
    expect(fs.existsSync(dir)).toBe(true);
  });

  it('원격을 받지 못하면 예전 상태로 판단했다고 알린다', async () => {
    addWorktree('one', 'feature/one');
    git(repo, 'remote', 'set-url', 'origin', path.join(work, 'missing.git'));

    const result = await gateway().scan(root, ['origin/dev']);

    expect(result.staleRepositories).toEqual([repo]);
    expect(result.inspections).toHaveLength(1);
  });

  it('정리 루트가 있는 디스크의 남은 공간을 잰다', async () => {
    await expect(gateway().freeBytes(root)).resolves.toBeGreaterThan(0);
  });

  it('심볼릭 링크로 된 폴더는 따라가지 않는다', async () => {
    const dir = addWorktree('real', 'feature/real');
    fs.symlinkSync(dir, path.join(root, 'link'));

    const result = await gateway().scan(root, ['origin/dev']);

    expect(result.inspections.map((i) => i.name)).toEqual(['real']);
  });
});
