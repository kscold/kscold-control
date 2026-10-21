import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { getHomeDirectory } from '../../../common/utils';
import type {
  IWorktreeWorkspaceGateway,
  RemoveWorktreeRequest,
  WorktreeScanResult,
} from '../../domain/repositories/worktree-workspace.gateway';
import type {
  RemovedWorktree,
  WorktreeInspection,
} from '../../domain/types/worktree.type';

const execFileAsync = promisify(execFile);

/** 연결된 작업 폴더의 `.git` 파일이 가리키는 위치 (`<저장소>/.git/worktrees/<이름>`) */
const LINKED_GITDIR_PATTERN = /^(.+)\/\.git\/worktrees\/[^/]+$/;

const GIT_TIMEOUT_MS = 30_000;
const FETCH_TIMEOUT_MS = 60_000;
const DU_TIMEOUT_MS = 180_000;

/** 지우기 전에 남기는 로컬 전용 파일 하나의 최대 크기. 빌드 산출물 같은 큰 파일은 남기지 않는다. */
const MAX_BACKUP_FILE_BYTES = 5 * 1024 * 1024;
/** 작업 폴더 하나에서 남기는 로컬 전용 파일 전체의 최대 크기 */
const MAX_BACKUP_TOTAL_BYTES = 50 * 1024 * 1024;

/**
 * git 이 사람에게 묻지 않게 한다. 백그라운드에서 인증 창이나 질문을 띄우면
 * 아무도 답하지 못해 끝나지 않기 때문이다.
 */
const NON_INTERACTIVE_GIT_ENV = {
  ...process.env,
  GIT_TERMINAL_PROMPT: '0',
  GIT_SSH_COMMAND: 'ssh -o BatchMode=yes -o ConnectTimeout=15',
};

interface LinkedWorktree {
  name: string;
  path: string;
  gitDir: string;
  repositoryPath: string;
}

/**
 * git 작업 폴더(worktree)를 살펴보고 지우는 어댑터
 *
 * 지우는 것은 `git worktree remove` 로만 한다. 원본 저장소와 브랜치는 그대로 두므로
 * 같은 브랜치로 언제든 다시 만들 수 있다. 지우기 전에 Git 이 추적하지 않는 로컬 전용
 * 파일(.env 등)을 백업 디렉터리에 남기고, 다시 만드는 방법을 함께 적어 둔다.
 */
@Injectable()
export class GitWorktreeWorkspaceGateway implements IWorktreeWorkspaceGateway {
  private readonly logger = new Logger(GitWorktreeWorkspaceGateway.name);

  protected readonly backupRoot: string = path.join(
    getHomeDirectory(),
    'Desktop',
    'server-logs',
    'worktree-cleanup',
  );

  async freeBytes(rootPath: string): Promise<number> {
    const stats = await fs.promises.statfs(rootPath);
    return Number(stats.bavail) * Number(stats.bsize);
  }

  async rootExists(rootPath: string): Promise<boolean> {
    try {
      return (await fs.promises.stat(rootPath)).isDirectory();
    } catch {
      return false;
    }
  }

  async scan(
    rootPath: string,
    baseRefs: string[],
  ): Promise<WorktreeScanResult> {
    const { worktrees, failures } = await this.listLinkedWorktrees(rootPath);

    // 원격 상태를 새로 받아야 "이미 들어갔는지·원격에 있는지"를 정확히 판단한다.
    // 받지 못하면 예전 상태로 판단하는데, 그때는 덜 지우는 쪽으로 틀린다.
    const staleRepositories: string[] = [];
    for (const repositoryPath of new Set(
      worktrees.map((w) => w.repositoryPath),
    )) {
      try {
        await this.git(
          repositoryPath,
          ['fetch', '--quiet', 'origin'],
          FETCH_TIMEOUT_MS,
        );
      } catch {
        staleRepositories.push(repositoryPath);
      }
    }

    const activeDirectories = await this.listActiveDirectories();
    const inspections: WorktreeInspection[] = [];
    for (const worktree of worktrees) {
      try {
        inspections.push(
          await this.inspect(worktree, baseRefs, activeDirectories),
        );
      } catch (error) {
        failures.push({
          name: worktree.name,
          path: worktree.path,
          message: toMessage(error).slice(0, 300),
        });
      }
    }

    return { inspections, failures, staleRepositories };
  }

  async remove(request: RemoveWorktreeRequest): Promise<RemovedWorktree> {
    const planned = request.inspection;

    // 살펴본 뒤 지우기 전까지 상태가 바뀌었을 수 있어 바로 앞에서 다시 확인한다.
    const worktree = await this.readLinkedWorktree(
      path.dirname(planned.path),
      planned.name,
    );
    const current = await this.inspect(
      worktree,
      request.baseRefs,
      await this.listActiveDirectories(),
    );
    if (current.headSha !== planned.headSha) {
      throw new Error('살펴본 뒤 새 커밋이 생겨 지우지 않았습니다.');
    }
    if (current.active) {
      throw new Error('실행 중인 프로세스가 생겨 지우지 않았습니다.');
    }
    if (current.uncommittedCount > 0 || current.unpushedCount > 0) {
      throw new Error(
        '커밋하지 않은 변경이나 원격에 없는 커밋이 생겨 지우지 않았습니다.',
      );
    }

    const backupPath = await this.backupLocalFiles(request.targetName, current);
    await this.git(
      current.repositoryPath,
      ['worktree', 'remove', '--force', current.path],
      GIT_TIMEOUT_MS,
    );
    // 남은 관리 정보를 정리한다. 실패해도 작업 폴더는 이미 지워졌으므로 결과는 바꾸지 않는다.
    await this.git(
      current.repositoryPath,
      ['worktree', 'prune'],
      GIT_TIMEOUT_MS,
    ).catch((error) =>
      this.logger.warn(
        `worktree prune 실패 (${current.repositoryPath}): ${toMessage(error)}`,
      ),
    );

    return {
      name: current.name,
      branch: current.branch,
      headSha: current.headSha,
      repositoryPath: current.repositoryPath,
      sizeBytes: current.sizeBytes,
      backupPath,
    };
  }

  /** 루트 바로 아래에서 연결된 작업 폴더만 고른다. 원본 저장소·심볼릭 링크는 건드리지 않는다. */
  private async listLinkedWorktrees(rootPath: string) {
    const realRoot = await fs.promises.realpath(rootPath);
    const worktrees: LinkedWorktree[] = [];
    const failures: WorktreeScanResult['failures'] = [];

    const entries = await fs.promises.readdir(realRoot, {
      withFileTypes: true,
    });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      try {
        worktrees.push(await this.readLinkedWorktree(realRoot, entry.name));
      } catch (error) {
        failures.push({
          name: entry.name,
          path: path.join(realRoot, entry.name),
          message: toMessage(error),
        });
      }
    }

    return {
      worktrees: worktrees.sort((a, b) => a.name.localeCompare(b.name)),
      failures,
    };
  }

  private async readLinkedWorktree(
    realRoot: string,
    name: string,
  ): Promise<LinkedWorktree> {
    const directory = path.join(realRoot, name);
    if ((await fs.promises.realpath(directory)) !== directory) {
      throw new Error('심볼릭 링크라 정리 대상에서 뺐습니다.');
    }

    let gitFile: string;
    try {
      gitFile = await fs.promises.readFile(
        path.join(directory, '.git'),
        'utf8',
      );
    } catch {
      throw new Error('git 작업 폴더가 아닙니다 (.git 파일 없음).');
    }

    const gitDir = /^gitdir:\s*(.+)\s*$/m.exec(gitFile)?.[1]?.trim();
    const repositoryPath = gitDir
      ? LINKED_GITDIR_PATTERN.exec(gitDir)?.[1]
      : undefined;
    if (!gitDir || !repositoryPath) {
      throw new Error('원본 저장소에 연결된 작업 폴더가 아닙니다.');
    }
    // 원본 저장소이거나 원본 저장소를 품은 폴더는 지우면 안 된다.
    if (
      repositoryPath === directory ||
      repositoryPath.startsWith(`${directory}/`)
    ) {
      throw new Error('원본 저장소라 정리 대상에서 뺐습니다.');
    }
    await fs.promises.access(gitDir);

    return { name, path: directory, gitDir, repositoryPath };
  }

  private async inspect(
    worktree: LinkedWorktree,
    baseRefs: string[],
    activeDirectories: string[],
  ): Promise<WorktreeInspection> {
    const dir = worktree.path;
    const branch = (await this.git(dir, ['branch', '--show-current'])).trim();
    const headSha = (await this.git(dir, ['rev-parse', 'HEAD'])).trim();
    const committedAt = new Date(
      (await this.git(dir, ['log', '-1', '--format=%cI'])).trim(),
    );
    const status = await this.git(dir, [
      'status',
      '--porcelain',
      '--untracked-files=all',
    ]);
    const unpushed = Number(
      (
        await this.git(dir, [
          'rev-list',
          '--count',
          'HEAD',
          '--not',
          '--remotes',
        ])
      ).trim(),
    );

    let merged = false;
    for (const ref of baseRefs) {
      const exists = await this.git(dir, [
        'rev-parse',
        '--verify',
        '--quiet',
        `${ref}^{commit}`,
      ])
        .then(() => true)
        .catch(() => false);
      if (!exists) continue;
      const ancestor = await this.git(dir, [
        'merge-base',
        '--is-ancestor',
        'HEAD',
        ref,
      ])
        .then(() => true)
        .catch(() => false);
      if (ancestor) {
        merged = true;
        break;
      }
    }

    // 커밋 없이 파일만 고친 작업도 "최근 작업"으로 치려고 인덱스가 바뀐 시각도 본다.
    let lastActivityAt = committedAt;
    try {
      const indexChangedAt = (
        await fs.promises.stat(path.join(worktree.gitDir, 'index'))
      ).mtime;
      if (indexChangedAt > lastActivityAt) lastActivityAt = indexChangedAt;
    } catch {
      // 인덱스가 없으면 커밋 시각만 쓴다.
    }

    return {
      name: worktree.name,
      path: dir,
      repositoryPath: worktree.repositoryPath,
      branch: branch || null,
      headSha,
      lastActivityAt,
      uncommittedCount: status.split('\n').filter(Boolean).length,
      unpushedCount: Number.isFinite(unpushed) ? unpushed : 1,
      merged,
      active: activeDirectories.some(
        (cwd) => cwd === dir || cwd.startsWith(`${dir}/`),
      ),
      sizeBytes: await this.measure(dir),
    };
  }

  /** 현재 사용자의 프로세스들이 작업 디렉터리로 쓰고 있는 경로 */
  private async listActiveDirectories(): Promise<string[]> {
    const lsof = fs.existsSync('/usr/sbin/lsof') ? '/usr/sbin/lsof' : 'lsof';
    try {
      const { stdout } = await execFileAsync(
        lsof,
        ['-nP', '-a', '-u', os.userInfo().username, '-d', 'cwd', '-F', 'n'],
        { timeout: GIT_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 },
      );
      return parseLsofNames(stdout);
    } catch (error) {
      // 해당 프로세스가 하나도 없으면 lsof 가 1 로 끝난다. 출력이 있으면 그대로 쓴다.
      const stdout = (error as { stdout?: string }).stdout;
      if (typeof stdout === 'string' && stdout.length > 0) {
        return parseLsofNames(stdout);
      }
      // 실행 중인지 알 수 없으면 지우면 안 되므로 오류로 멈춘다.
      return activityCheckFailed(error);
    }
  }

  /**
   * Git 이 추적하지 않는 로컬 전용 파일(.env 등)과 다시 만드는 방법을 남긴다.
   * 무시 목록에 걸린 디렉터리(node_modules, .next 등)는 다시 설치·빌드하면 되므로 남기지 않는다.
   */
  private async backupLocalFiles(
    targetName: string,
    worktree: WorktreeInspection,
  ): Promise<string> {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const destination = path.join(
      this.backupRoot,
      targetName,
      stamp,
      worktree.name,
    );
    const filesDir = path.join(destination, 'files');
    await fs.promises.mkdir(filesDir, { recursive: true, mode: 0o700 });

    const listed = await this.git(worktree.path, [
      'ls-files',
      '--others',
      '--ignored',
      '--exclude-standard',
      '--directory',
      '-z',
    ]);
    const saved: string[] = [];
    const skipped: string[] = [];
    let total = 0;

    for (const relative of listed.split('\0').filter(Boolean)) {
      if (relative.endsWith('/')) {
        skipped.push(relative);
        continue;
      }
      const source = path.join(worktree.path, relative);
      const info = await fs.promises.lstat(source).catch(() => null);
      if (!info || !info.isFile()) continue;
      if (
        info.size > MAX_BACKUP_FILE_BYTES ||
        total + info.size > MAX_BACKUP_TOTAL_BYTES
      ) {
        skipped.push(relative);
        continue;
      }
      const target = path.join(filesDir, relative);
      await fs.promises.mkdir(path.dirname(target), {
        recursive: true,
        mode: 0o700,
      });
      await fs.promises.copyFile(source, target);
      await fs.promises.chmod(target, 0o600);
      total += info.size;
      saved.push(relative);
    }

    const checkout = worktree.branch ?? worktree.headSha;
    const manifest = {
      name: worktree.name,
      path: worktree.path,
      repositoryPath: worktree.repositoryPath,
      branch: worktree.branch,
      headSha: worktree.headSha,
      removedAt: new Date().toISOString(),
      savedFiles: saved,
      skippedLocalEntries: skipped,
      restore: `git -C '${worktree.repositoryPath}' worktree add '${worktree.path}' '${checkout}' && cp -Rp '${filesDir}/.' '${worktree.path}/'`,
    };
    await fs.promises.writeFile(
      path.join(destination, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
      { mode: 0o600 },
    );

    return destination;
  }

  private async measure(directory: string): Promise<number> {
    try {
      const { stdout } = await execFileAsync('du', ['-sk', directory], {
        timeout: DU_TIMEOUT_MS,
      });
      return Number(stdout.trim().split(/\s+/)[0]) * 1024 || 0;
    } catch {
      // 크기를 재지 못했다고 판단을 바꾸지 않는다.
      return 0;
    }
  }

  protected async git(
    cwd: string,
    args: string[],
    timeout = GIT_TIMEOUT_MS,
  ): Promise<string> {
    const { stdout } = await execFileAsync('git', ['-C', cwd, ...args], {
      timeout,
      env: NON_INTERACTIVE_GIT_ENV,
      maxBuffer: 32 * 1024 * 1024,
    });
    return stdout;
  }
}

/** 실행 중인지 알 수 없으면 지우면 안 되므로 오류로 멈춘다. */
function activityCheckFailed(error: unknown): never {
  throw new Error(
    `실행 중인 프로세스를 확인하지 못했습니다: ${toMessage(error)}`,
  );
}

function parseLsofNames(stdout: string): string[] {
  return stdout
    .split('\n')
    .filter((line) => line.startsWith('n'))
    .map((line) => line.slice(1));
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
