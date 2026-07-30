import { execFile } from 'node:child_process';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { isPathInsideRoot } from '../../../common/utils';
import { PtyManagerService } from './pty-manager.service';
import type {
  GitCommandResult,
  GitContext,
  GitHubRemoteTarget,
  ParsedWorkspaceDiffHunk,
  ResolvedWorkspacePath,
  WorkspaceChangeKind,
  WorkspaceFileResult,
  WorkspaceGitChange,
  WorkspacePullRequestDraft,
  WorkspaceReviewState,
  WorkspaceShipStatus,
  WorkspaceTreeNode,
} from '../../domain/types/workspace-file.type';

const execFileAsync = promisify(execFile);

const IGNORED_WORKSPACE_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  '.turbo',
]);

/**
 * Workspace Git Service
 * Shared git/filesystem plumbing used by the workspace file use-cases.
 */
@Injectable()
export class WorkspaceGitService {
  constructor(private readonly ptyManager: PtyManagerService) {}

  getWorkspaceRoot(): string {
    return path.resolve(this.ptyManager.getWorkingDirectory());
  }

  toPosixPath(value: string): string {
    return value.split(path.sep).join('/');
  }

  private normalizeRequestedPath(rawPath: string): string {
    if (!rawPath?.trim()) {
      throw new BadRequestException('파일 경로가 필요합니다.');
    }

    const normalized = rawPath.replace(/[:#]\d+(?::\d+)?$/, '');
    if (!normalized.trim()) {
      throw new BadRequestException('파일 경로가 필요합니다.');
    }

    return normalized;
  }

  resolveWorkspacePath(rawPath: string): ResolvedWorkspacePath {
    const workspaceRoot = this.getWorkspaceRoot();
    const normalized = this.normalizeRequestedPath(rawPath);
    const absolutePath = path.isAbsolute(normalized)
      ? path.resolve(normalized)
      : path.resolve(workspaceRoot, normalized);

    if (!isPathInsideRoot(workspaceRoot, absolutePath)) {
      throw new ForbiddenException(
        '작업 디렉터리 바깥 파일에는 접근할 수 없습니다.',
      );
    }

    return {
      absolutePath,
      relativePath: this.toPosixPath(
        path.relative(workspaceRoot, absolutePath) ||
          path.basename(absolutePath),
      ),
    };
  }

  async assertWorkspacePath(
    resolvedPath: ResolvedWorkspacePath,
  ): Promise<void> {
    const workspaceRoot = this.getWorkspaceRoot();
    let existingPath = resolvedPath.absolutePath;
    let targetExists = true;

    try {
      try {
        await fs.lstat(existingPath);
      } catch {
        targetExists = false;
      }

      while (!targetExists && existingPath !== workspaceRoot) {
        existingPath = path.dirname(existingPath);
        try {
          await fs.lstat(existingPath);
          break;
        } catch {
          // Find the nearest existing parent for a new workspace file.
        }
      }

      const [realRoot, realExistingPath] = await Promise.all([
        fs.realpath(workspaceRoot),
        fs.realpath(existingPath),
      ]);
      // 심볼릭 링크까지 따라간 실제 경로로 다시 한 번 루트 포함 여부를 확인한다.
      if (!isPathInsideRoot(realRoot, realExistingPath)) {
        throw new ForbiddenException(
          '작업 디렉터리 바깥 파일에는 접근할 수 없습니다.',
        );
      }

      if (!targetExists) {
        return;
      }

      const realTarget = await fs.realpath(resolvedPath.absolutePath);
      if (!isPathInsideRoot(realRoot, realTarget)) {
        throw new ForbiddenException(
          '작업 디렉터리 바깥 파일에는 접근할 수 없습니다.',
        );
      }
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }

      throw new ForbiddenException('작업 디렉터리 경로를 확인할 수 없습니다.');
    }
  }

  async runGitCommand(
    args: string[],
    cwd: string,
    allowedExitCodes: number[] = [0],
  ): Promise<GitCommandResult> {
    try {
      const { stdout, stderr } = await execFileAsync('git', args, {
        cwd,
        encoding: 'utf8',
        maxBuffer: 8 * 1024 * 1024,
      });
      return { stdout, stderr, code: 0 };
    } catch (error) {
      const gitError = error as {
        stdout?: string;
        stderr?: string;
        code?: number | string;
      };
      const code =
        typeof gitError.code === 'number' ? gitError.code : Number.NaN;

      if (allowedExitCodes.includes(code)) {
        return {
          stdout: gitError.stdout ?? '',
          stderr: gitError.stderr ?? '',
          code,
        };
      }

      throw error;
    }
  }

  async applyGitPatch(
    args: string[],
    cwd: string,
    patch: string,
  ): Promise<void> {
    const tempDirectory = await fs.mkdtemp(
      path.join(os.tmpdir(), 'kscold-control-patch-'),
    );
    const patchPath = path.join(tempDirectory, 'selection.patch');

    try {
      await fs.writeFile(patchPath, patch, 'utf8');
      await this.runGitCommand([...args, patchPath], cwd);
    } finally {
      await fs.rm(tempDirectory, { recursive: true, force: true });
    }
  }

  async resolveGitContext(): Promise<GitContext> {
    const workspaceRoot = this.getWorkspaceRoot();

    try {
      const repoRootResult = await this.runGitCommand(
        ['rev-parse', '--show-toplevel'],
        workspaceRoot,
      );
      const repoRoot = repoRootResult.stdout.trim();
      if (!repoRoot) {
        return {
          enabled: false,
          repoRoot: null,
          branch: null,
        };
      }

      const branchResult = await this.runGitCommand(
        ['branch', '--show-current'],
        repoRoot,
      );
      const branch = branchResult.stdout.trim() || null;

      return {
        enabled: true,
        repoRoot,
        branch,
      };
    } catch {
      return {
        enabled: false,
        repoRoot: null,
        branch: null,
      };
    }
  }

  toWorkspaceFileResult(
    absolutePath: string,
    relativePath: string,
    buffer: Buffer,
    updatedAt: Date,
  ): WorkspaceFileResult {
    const isBinary = buffer.includes(0);

    return {
      path: relativePath,
      relativePath,
      absolutePath,
      size: buffer.byteLength,
      encoding: isBinary ? 'base64' : 'utf8',
      content: isBinary ? buffer.toString('base64') : buffer.toString('utf8'),
      updatedAt: updatedAt.toISOString(),
    };
  }

  private parseGitHubRemote(
    remoteUrl: string | null | undefined,
  ): GitHubRemoteTarget | null {
    if (!remoteUrl) {
      return null;
    }

    const httpsMatch = remoteUrl.match(
      /^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/,
    );
    if (httpsMatch) {
      return {
        owner: httpsMatch[1],
        repo: httpsMatch[2],
      };
    }

    const sshMatch = remoteUrl.match(
      /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/,
    );
    if (sshMatch) {
      return {
        owner: sshMatch[1],
        repo: sshMatch[2],
      };
    }

    return null;
  }

  buildCompareUrl(
    remoteUrl: string | null,
    baseBranch: string | null,
    currentBranch: string | null,
  ): string | null {
    if (
      !remoteUrl ||
      !baseBranch ||
      !currentBranch ||
      baseBranch === currentBranch
    ) {
      return null;
    }

    const parsedRemote = this.parseGitHubRemote(remoteUrl);
    if (!parsedRemote) {
      return null;
    }

    return `https://github.com/${parsedRemote.owner}/${parsedRemote.repo}/compare/${baseBranch}...${currentBranch}?expand=1`;
  }

  async resolveRemoteUrl(gitContext: GitContext): Promise<string | null> {
    if (!gitContext.enabled || !gitContext.repoRoot) {
      return null;
    }

    try {
      const result = await this.runGitCommand(
        ['remote', 'get-url', 'origin'],
        gitContext.repoRoot,
      );
      return result.stdout.trim() || null;
    } catch {
      return null;
    }
  }

  async resolveDefaultBaseBranch(
    gitContext: GitContext,
  ): Promise<string | null> {
    if (!gitContext.enabled || !gitContext.repoRoot) {
      return null;
    }

    try {
      const result = await this.runGitCommand(
        ['symbolic-ref', 'refs/remotes/origin/HEAD'],
        gitContext.repoRoot,
      );
      const ref = result.stdout.trim();
      const branch = ref.split('/').at(-1) || null;
      if (branch) {
        return branch;
      }
    } catch {
      // continue to fallback resolution
    }

    for (const candidate of ['main', 'master']) {
      try {
        await this.runGitCommand(
          ['rev-parse', '--verify', `origin/${candidate}`],
          gitContext.repoRoot,
        );
        return candidate;
      } catch {
        // try next candidate
      }
    }

    return null;
  }

  async resolveLastCommit(
    gitContext: GitContext,
  ): Promise<WorkspaceShipStatus['lastCommit']> {
    if (!gitContext.enabled || !gitContext.repoRoot) {
      return null;
    }

    try {
      const result = await this.runGitCommand(
        ['log', '-1', '--pretty=format:%H%n%s'],
        gitContext.repoRoot,
      );
      const [sha, message] = result.stdout.split('\n');
      if (!sha || !message) {
        return null;
      }

      return {
        sha: sha.trim(),
        message: message.trim(),
      };
    } catch {
      return null;
    }
  }

  async resolveTrackingBranch(gitContext: GitContext): Promise<string | null> {
    if (!gitContext.enabled || !gitContext.repoRoot) {
      return null;
    }

    try {
      const result = await this.runGitCommand(
        ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'],
        gitContext.repoRoot,
        [0, 128],
      );
      if (result.code !== 0) {
        return null;
      }
      return result.stdout.trim() || null;
    } catch {
      return null;
    }
  }

  private createDraftTitle(
    branch: string | null,
    lastCommit: WorkspaceShipStatus['lastCommit'],
  ): string {
    if (lastCommit?.message) {
      return lastCommit.message;
    }

    if (branch) {
      return `feat: ${branch.replace(/[-_/]+/g, ' ')}`;
    }

    return 'feat: Claude Code workspace updates';
  }

  private createDraftBody(
    changes: WorkspaceGitChange[],
    branch: string | null,
  ): string {
    const changedFiles = changes
      .slice(0, 8)
      .map((change) => `- \`${change.path}\``);
    const summary = changedFiles.length
      ? changedFiles.join('\n')
      : '- Claude Code workspace updates';

    return [
      '## Summary',
      summary,
      '',
      '## Testing',
      '- [x] Verified locally in Claude Code workspace',
      '',
      '## Notes',
      branch
        ? `- Working branch: \`${branch}\``
        : '- Review branch name before opening this PR',
    ].join('\n');
  }

  private buildPullRequestDraft(input: {
    branch: string | null;
    baseBranch: string | null;
    compareUrl: string | null;
    lastCommit: WorkspaceShipStatus['lastCommit'];
    changes: WorkspaceGitChange[];
  }): WorkspacePullRequestDraft {
    return {
      title: this.createDraftTitle(input.branch, input.lastCommit),
      body: this.createDraftBody(input.changes, input.branch),
      compareUrl: input.compareUrl,
      branch: input.branch,
      baseBranch: input.baseBranch,
      canOpen: Boolean(input.compareUrl),
    };
  }

  sanitizeBranchName(rawBranchName: string): string {
    const normalized = rawBranchName
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^A-Za-z0-9._/-]+/g, '-')
      .replace(/\/{2,}/g, '/')
      .replace(/^-+|-+$/g, '');

    if (!normalized) {
      throw new BadRequestException('브랜치 이름을 입력해주세요.');
    }

    if (normalized.startsWith('/') || normalized.endsWith('/')) {
      throw new BadRequestException('브랜치 이름 형식이 올바르지 않습니다.');
    }

    return normalized;
  }

  async assertValidBranchName(
    branchName: string,
    gitContext: GitContext,
  ): Promise<void> {
    if (!gitContext.enabled || !gitContext.repoRoot) {
      throw new BadRequestException(
        'Git 작업공간에서만 브랜치 이름을 검증할 수 있습니다.',
      );
    }

    const result = await this.runGitCommand(
      ['check-ref-format', '--branch', branchName],
      gitContext.repoRoot,
      [0, 1],
    );
    if (result.code !== 0) {
      throw new BadRequestException('브랜치 이름 형식이 올바르지 않습니다.');
    }
  }

  async buildShipStatus(
    gitContext: GitContext,
    changes: WorkspaceGitChange[],
  ): Promise<WorkspaceShipStatus> {
    if (!gitContext.enabled) {
      return {
        gitEnabled: false,
        branch: null,
        defaultBaseBranch: null,
        trackingBranch: null,
        isOnDefaultBranch: false,
        hasRemoteTracking: false,
        remoteUrl: null,
        compareUrl: null,
        changedCount: changes.length,
        stagedCount: 0,
        lastCommit: null,
        draft: this.buildPullRequestDraft({
          branch: null,
          baseBranch: null,
          compareUrl: null,
          lastCommit: null,
          changes,
        }),
      };
    }

    const [remoteUrl, defaultBaseBranch, lastCommit, trackingBranch] =
      await Promise.all([
        this.resolveRemoteUrl(gitContext),
        this.resolveDefaultBaseBranch(gitContext),
        this.resolveLastCommit(gitContext),
        this.resolveTrackingBranch(gitContext),
      ]);
    const compareUrl = this.buildCompareUrl(
      remoteUrl,
      defaultBaseBranch,
      gitContext.branch,
    );

    return {
      gitEnabled: true,
      branch: gitContext.branch,
      defaultBaseBranch,
      trackingBranch,
      isOnDefaultBranch:
        Boolean(defaultBaseBranch) && gitContext.branch === defaultBaseBranch,
      hasRemoteTracking: Boolean(trackingBranch),
      remoteUrl,
      compareUrl,
      changedCount: changes.length,
      stagedCount: changes.filter((change) => change.staged).length,
      lastCommit,
      draft: this.buildPullRequestDraft({
        branch: gitContext.branch,
        baseBranch: defaultBaseBranch,
        compareUrl,
        lastCommit,
        changes,
      }),
    };
  }

  private parseNameStatusOutput(
    output: string,
    options: {
      staged: boolean;
      unstaged: boolean;
      repoRoot: string;
      workspaceRoot: string;
    },
  ): WorkspaceGitChange[] {
    const entries = output.split('\0');
    const changes: WorkspaceGitChange[] = [];

    for (let index = 0; index + 1 < entries.length; index += 2) {
      const statusCode = entries[index];
      const rawPath = entries[index + 1];
      if (!statusCode || !rawPath) {
        continue;
      }

      const absolutePath = path.resolve(options.repoRoot, rawPath);
      if (
        absolutePath !== options.workspaceRoot &&
        !absolutePath.startsWith(`${options.workspaceRoot}${path.sep}`)
      ) {
        continue;
      }

      const kind: WorkspaceChangeKind = statusCode.startsWith('A')
        ? 'added'
        : statusCode.startsWith('D')
          ? 'deleted'
          : 'modified';
      const relativePath = this.toPosixPath(
        path.relative(options.workspaceRoot, absolutePath),
      );

      changes.push({
        path: relativePath,
        absolutePath,
        kind,
        reviewState: 'clean',
        staged: options.staged,
        unstaged: options.unstaged,
      });
    }

    return changes;
  }

  private mergeGitChanges(changes: WorkspaceGitChange[]): WorkspaceGitChange[] {
    const merged = new Map<string, WorkspaceGitChange>();

    for (const change of changes) {
      const existing = merged.get(change.path);
      if (!existing) {
        merged.set(change.path, {
          ...change,
          reviewState: this.resolveReviewState(
            change.kind,
            change.staged,
            change.unstaged,
          ),
        });
        continue;
      }

      const staged = existing.staged || change.staged;
      const unstaged = existing.unstaged || change.unstaged;
      const kind =
        existing.kind === 'deleted' || change.kind === 'deleted'
          ? 'deleted'
          : existing.kind === 'added' || change.kind === 'added'
            ? 'added'
            : existing.kind === 'untracked' || change.kind === 'untracked'
              ? 'untracked'
              : 'modified';

      merged.set(change.path, {
        ...existing,
        ...change,
        kind,
        staged,
        unstaged,
        reviewState: this.resolveReviewState(kind, staged, unstaged),
      });
    }

    return [...merged.values()].sort((left, right) =>
      left.path.localeCompare(right.path),
    );
  }

  private resolveReviewState(
    kind: WorkspaceChangeKind,
    staged: boolean,
    unstaged: boolean,
  ): WorkspaceReviewState {
    if (kind === 'untracked') return 'untracked';
    if (staged && unstaged) return 'mixed';
    if (staged) return 'staged';
    if (kind === 'added') return 'added';
    if (kind === 'deleted') return 'deleted';
    return 'modified';
  }

  async listGitChanges(
    workspaceRoot: string,
    gitContext: GitContext,
  ): Promise<WorkspaceGitChange[]> {
    if (!gitContext.enabled || !gitContext.repoRoot) {
      return [];
    }

    const [stagedResult, unstagedResult, untrackedResult] = await Promise.all([
      this.runGitCommand(
        ['diff', '--name-status', '--cached', '--no-renames', '-z', '--'],
        gitContext.repoRoot,
      ),
      this.runGitCommand(
        ['diff', '--name-status', '--no-renames', '-z', '--'],
        gitContext.repoRoot,
      ),
      this.runGitCommand(
        ['ls-files', '--others', '--exclude-standard', '-z'],
        gitContext.repoRoot,
      ),
    ]);

    const stagedChanges = this.parseNameStatusOutput(stagedResult.stdout, {
      staged: true,
      unstaged: false,
      repoRoot: gitContext.repoRoot,
      workspaceRoot,
    });
    const unstagedChanges = this.parseNameStatusOutput(unstagedResult.stdout, {
      staged: false,
      unstaged: true,
      repoRoot: gitContext.repoRoot,
      workspaceRoot,
    });
    const untrackedChanges = untrackedResult.stdout
      .split('\0')
      .filter((rawPath) => rawPath.length > 0)
      .map((rawPath) => {
        const absolutePath = path.resolve(gitContext.repoRoot!, rawPath);
        return {
          rawPath,
          absolutePath,
        };
      })
      .filter(
        (entry) =>
          entry.absolutePath === workspaceRoot ||
          entry.absolutePath.startsWith(`${workspaceRoot}${path.sep}`),
      )
      .map<WorkspaceGitChange>((entry) => ({
        path: this.toPosixPath(
          path.relative(workspaceRoot, entry.absolutePath),
        ),
        absolutePath: entry.absolutePath,
        kind: 'untracked',
        reviewState: 'untracked',
        staged: false,
        unstaged: true,
      }));

    return this.mergeGitChanges([
      ...stagedChanges,
      ...unstagedChanges,
      ...untrackedChanges,
    ]);
  }

  getDirectoryReviewState(
    children: WorkspaceTreeNode[],
  ): WorkspaceReviewState | null {
    const states = children
      .map((child) => child.reviewState)
      .filter((state): state is WorkspaceReviewState => Boolean(state));

    if (states.includes('mixed')) return 'mixed';
    if (states.includes('staged')) return 'staged';
    if (states.includes('deleted')) return 'deleted';
    if (states.includes('added')) return 'added';
    if (states.includes('untracked')) return 'untracked';
    if (states.includes('modified')) return 'modified';
    return null;
  }

  async buildWorkspaceTree(
    directoryPath: string,
    relativePath: string,
    changeMap: Map<string, WorkspaceGitChange>,
  ): Promise<WorkspaceTreeNode[]> {
    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    const children: WorkspaceTreeNode[] = [];

    for (const entry of entries) {
      if (
        entry.isDirectory() &&
        IGNORED_WORKSPACE_DIRECTORIES.has(entry.name)
      ) {
        continue;
      }

      const absolutePath = path.join(directoryPath, entry.name);
      const childRelativePath = this.toPosixPath(
        relativePath ? path.join(relativePath, entry.name) : entry.name,
      );

      if (entry.isDirectory()) {
        const nestedChildren = await this.buildWorkspaceTree(
          absolutePath,
          childRelativePath,
          changeMap,
        );

        children.push({
          name: entry.name,
          path: childRelativePath,
          type: 'directory',
          children: nestedChildren,
          changed: nestedChildren.some((child) => child.changed),
          reviewState: this.getDirectoryReviewState(nestedChildren),
        });
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const stats = await fs.stat(absolutePath);
      const change = changeMap.get(childRelativePath);

      children.push({
        name: entry.name,
        path: childRelativePath,
        type: 'file',
        size: stats.size,
        changed: Boolean(change),
        reviewState: change?.reviewState ?? null,
      });
    }

    return children.sort((left, right) => {
      if (left.type !== right.type) {
        return left.type === 'directory' ? -1 : 1;
      }
      return left.name.localeCompare(right.name);
    });
  }

  getRepoRelativePath(
    resolvedPath: ResolvedWorkspacePath,
    gitContext: GitContext,
  ): string {
    if (!gitContext.repoRoot) {
      return resolvedPath.relativePath;
    }

    return this.toPosixPath(
      path.relative(gitContext.repoRoot, resolvedPath.absolutePath),
    );
  }

  parseDiffHunks(diff: string): ParsedWorkspaceDiffHunk[] {
    if (!diff.trim()) {
      return [];
    }

    const lines = diff.replace(/\r\n/g, '\n').split('\n');
    const fileHeader: string[] = [];
    const hunks: ParsedWorkspaceDiffHunk[] = [];
    let currentLines: string[] = [];
    let currentHeader = '';

    const flushCurrentHunk = () => {
      if (currentLines.length === 0) {
        return;
      }

      const patch = [...fileHeader, ...currentLines]
        .join('\n')
        .replace(/\n*$/, '\n');
      const bodyLines = currentLines.slice(1);

      hunks.push({
        index: hunks.length,
        header: currentHeader,
        preview: currentLines.join('\n'),
        additions: bodyLines.filter((line) => line.startsWith('+')).length,
        deletions: bodyLines.filter((line) => line.startsWith('-')).length,
        canStage: true,
        canRevert: true,
        patch,
      });
    };

    for (const line of lines) {
      if (line.startsWith('@@')) {
        flushCurrentHunk();
        currentHeader = line;
        currentLines = [line];
        continue;
      }

      if (currentLines.length > 0) {
        currentLines.push(line);
        continue;
      }

      fileHeader.push(line);
    }

    flushCurrentHunk();

    return hunks;
  }

  async resolveActionDiffForChange(
    resolvedPath: ResolvedWorkspacePath,
    change: WorkspaceGitChange,
    gitContext: GitContext,
  ): Promise<string> {
    if (!gitContext.enabled || !gitContext.repoRoot) {
      return '';
    }

    const repoRelativePath = this.getRepoRelativePath(resolvedPath, gitContext);

    if (change.kind === 'untracked') {
      const result = await this.runGitCommand(
        ['diff', '--no-index', '--', '/dev/null', repoRelativePath],
        gitContext.repoRoot,
        [0, 1],
      );
      return result.stdout;
    }

    const result = await this.runGitCommand(
      ['diff', '--no-ext-diff', '--binary', '--', repoRelativePath],
      gitContext.repoRoot,
      [0, 1],
    );
    return result.stdout;
  }

  async resolveDiffForChange(
    resolvedPath: ResolvedWorkspacePath,
    change: WorkspaceGitChange,
    gitContext: GitContext,
  ): Promise<string> {
    if (!gitContext.enabled || !gitContext.repoRoot) {
      return '';
    }

    const repoRelativePath = this.getRepoRelativePath(resolvedPath, gitContext);

    if (change.kind === 'untracked') {
      const result = await this.runGitCommand(
        ['diff', '--no-index', '--', '/dev/null', repoRelativePath],
        gitContext.repoRoot,
        [0, 1],
      );
      return result.stdout;
    }

    const result = await this.runGitCommand(
      ['diff', '--no-ext-diff', '--binary', 'HEAD', '--', repoRelativePath],
      gitContext.repoRoot,
      [0, 1],
    );
    return result.stdout;
  }

  async resolveHunkPatch(
    resolvedPath: ResolvedWorkspacePath,
    change: WorkspaceGitChange,
    gitContext: GitContext,
    hunkIndex: number,
  ): Promise<ParsedWorkspaceDiffHunk> {
    const actionDiff = await this.resolveActionDiffForChange(
      resolvedPath,
      change,
      gitContext,
    );
    const hunks = this.parseDiffHunks(actionDiff);
    const targetHunk = hunks.find((hunk) => hunk.index === hunkIndex);

    if (!targetHunk) {
      throw new NotFoundException('선택한 hunk를 찾지 못했습니다.');
    }

    return targetHunk;
  }
}
