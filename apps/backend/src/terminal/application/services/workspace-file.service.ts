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
import { PtyManagerService } from './pty-manager.service';

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

export type WorkspaceFileEncoding = 'utf8' | 'base64';
export type WorkspaceChangeKind =
  | 'modified'
  | 'added'
  | 'deleted'
  | 'untracked';
export type WorkspaceReviewState =
  | 'clean'
  | 'modified'
  | 'added'
  | 'deleted'
  | 'untracked'
  | 'staged'
  | 'mixed';

export interface WorkspaceFileResult {
  path: string;
  relativePath: string;
  absolutePath: string;
  size: number;
  encoding: WorkspaceFileEncoding;
  content: string;
  updatedAt: string;
}

export interface WorkspaceGitChange {
  path: string;
  absolutePath: string;
  kind: WorkspaceChangeKind;
  reviewState: WorkspaceReviewState;
  staged: boolean;
  unstaged: boolean;
}

export interface WorkspaceTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: WorkspaceTreeNode[];
  changed: boolean;
  reviewState: WorkspaceReviewState | null;
}

export interface WorkspaceTreeResult {
  root: WorkspaceTreeNode;
  changes: WorkspaceGitChange[];
  git: {
    enabled: boolean;
    rootPath: string | null;
    branch: string | null;
  };
  ship: WorkspaceShipStatus;
}

export interface WorkspaceDiffResult {
  path: string;
  absolutePath: string;
  gitEnabled: boolean;
  changeKind: WorkspaceChangeKind | null;
  reviewState: WorkspaceReviewState;
  staged: boolean;
  unstaged: boolean;
  diff: string;
  hunks: WorkspaceDiffHunk[];
  canAccept: boolean;
  canReject: boolean;
}

export interface WorkspaceDiffHunk {
  index: number;
  header: string;
  preview: string;
  additions: number;
  deletions: number;
  canStage: boolean;
  canRevert: boolean;
}

export interface WorkspaceShipStatus {
  gitEnabled: boolean;
  branch: string | null;
  defaultBaseBranch: string | null;
  trackingBranch: string | null;
  isOnDefaultBranch: boolean;
  hasRemoteTracking: boolean;
  remoteUrl: string | null;
  compareUrl: string | null;
  changedCount: number;
  stagedCount: number;
  lastCommit: {
    sha: string;
    message: string;
  } | null;
  draft: WorkspacePullRequestDraft;
}

export interface WorkspaceCommitResult {
  ok: true;
  commitSha: string;
  commitMessage: string;
  branch: string | null;
  compareUrl: string | null;
}

export interface WorkspaceBranchResult {
  ok: true;
  branch: string;
  compareUrl: string | null;
}

export interface WorkspacePushResult {
  ok: true;
  branch: string | null;
  trackingBranch: string | null;
  remoteUrl: string | null;
  compareUrl: string | null;
}

export interface WorkspacePullRequestDraft {
  title: string;
  body: string;
  compareUrl: string | null;
  branch: string | null;
  baseBranch: string | null;
  canOpen: boolean;
}

interface GitContext {
  enabled: boolean;
  repoRoot: string | null;
  branch: string | null;
}

interface ResolvedWorkspacePath {
  absolutePath: string;
  relativePath: string;
}

interface GitCommandResult {
  stdout: string;
  stderr: string;
  code: number;
}

interface GitHubRemoteTarget {
  owner: string;
  repo: string;
}

interface ParsedWorkspaceDiffHunk extends WorkspaceDiffHunk {
  patch: string;
}

@Injectable()
export class WorkspaceFileService {
  constructor(private readonly ptyManager: PtyManagerService) {}

  private getWorkspaceRoot(): string {
    return path.resolve(this.ptyManager.getWorkingDirectory());
  }

  private toPosixPath(value: string): string {
    return value.split(path.sep).join('/');
  }

  private normalizeRequestedPath(rawPath: string): string {
    const trimmed = rawPath.trim();
    if (!trimmed) {
      throw new BadRequestException('파일 경로가 필요합니다.');
    }

    return trimmed.replace(/[:#]\d+(?::\d+)?$/, '');
  }

  private resolveWorkspacePath(rawPath: string): ResolvedWorkspacePath {
    const workspaceRoot = this.getWorkspaceRoot();
    const normalized = this.normalizeRequestedPath(rawPath);
    const absolutePath = path.isAbsolute(normalized)
      ? path.resolve(normalized)
      : path.resolve(workspaceRoot, normalized);

    if (
      absolutePath !== workspaceRoot &&
      !absolutePath.startsWith(`${workspaceRoot}${path.sep}`)
    ) {
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

  private async runGitCommand(
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

  private async applyGitPatch(
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

  private async resolveGitContext(): Promise<GitContext> {
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

  private toWorkspaceFileResult(
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

  private buildCompareUrl(
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

  private async resolveRemoteUrl(
    gitContext: GitContext,
  ): Promise<string | null> {
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

  private async resolveDefaultBaseBranch(
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

  private async resolveLastCommit(
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

  private async resolveTrackingBranch(
    gitContext: GitContext,
  ): Promise<string | null> {
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

  private sanitizeBranchName(rawBranchName: string): string {
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

  private async buildShipStatus(
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
    const entries = output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const changes: WorkspaceGitChange[] = [];

    for (const entry of entries) {
      const [statusCode, rawPath] = entry.split('\t');
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
          reviewState: change.kind,
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

      let reviewState: WorkspaceReviewState = kind;
      if (kind !== 'untracked') {
        if (staged && unstaged) {
          reviewState = 'mixed';
        } else if (staged) {
          reviewState = 'staged';
        } else if (kind === 'added') {
          reviewState = 'added';
        } else if (kind === 'deleted') {
          reviewState = 'deleted';
        } else {
          reviewState = 'modified';
        }
      }

      merged.set(change.path, {
        ...existing,
        ...change,
        kind,
        staged,
        unstaged,
        reviewState,
      });
    }

    return [...merged.values()].sort((left, right) =>
      left.path.localeCompare(right.path),
    );
  }

  private async listGitChanges(
    workspaceRoot: string,
    gitContext: GitContext,
  ): Promise<WorkspaceGitChange[]> {
    if (!gitContext.enabled || !gitContext.repoRoot) {
      return [];
    }

    const [stagedResult, unstagedResult, untrackedResult] = await Promise.all([
      this.runGitCommand(
        ['diff', '--name-status', '--cached', '--no-renames', '--'],
        gitContext.repoRoot,
      ),
      this.runGitCommand(
        ['diff', '--name-status', '--no-renames', '--'],
        gitContext.repoRoot,
      ),
      this.runGitCommand(
        ['ls-files', '--others', '--exclude-standard'],
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
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
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

  private getDirectoryReviewState(
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

  private async buildWorkspaceTree(
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

  private getRepoRelativePath(
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

  private parseDiffHunks(diff: string): ParsedWorkspaceDiffHunk[] {
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

  private async resolveActionDiffForChange(
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

  private async resolveDiffForChange(
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

  private async resolveHunkPatch(
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

  async readFile(filePath: string): Promise<WorkspaceFileResult> {
    const { absolutePath, relativePath } = this.resolveWorkspacePath(filePath);

    try {
      const [buffer, stats] = await Promise.all([
        fs.readFile(absolutePath),
        fs.stat(absolutePath),
      ]);

      if (!stats.isFile()) {
        throw new NotFoundException('파일이 아닙니다.');
      }

      return this.toWorkspaceFileResult(
        absolutePath,
        relativePath,
        buffer,
        stats.mtime,
      );
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new NotFoundException('파일을 찾을 수 없습니다.');
    }
  }

  async writeFile(
    filePath: string,
    content: string,
  ): Promise<WorkspaceFileResult> {
    const { absolutePath, relativePath } = this.resolveWorkspacePath(filePath);

    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, content, 'utf8');

    const [buffer, stats] = await Promise.all([
      fs.readFile(absolutePath),
      fs.stat(absolutePath),
    ]);

    return this.toWorkspaceFileResult(
      absolutePath,
      relativePath,
      buffer,
      stats.mtime,
    );
  }

  async readTree(): Promise<WorkspaceTreeResult> {
    const workspaceRoot = this.getWorkspaceRoot();
    const gitContext = await this.resolveGitContext();
    const changes = await this.listGitChanges(workspaceRoot, gitContext);
    const changeMap = new Map(changes.map((change) => [change.path, change]));
    const children = await this.buildWorkspaceTree(
      workspaceRoot,
      '',
      changeMap,
    );
    const ship = await this.buildShipStatus(gitContext, changes);

    return {
      root: {
        name: path.basename(workspaceRoot),
        path: '.',
        type: 'directory',
        children,
        changed: children.some((child) => child.changed),
        reviewState: this.getDirectoryReviewState(children),
      },
      changes,
      git: {
        enabled: gitContext.enabled,
        rootPath: gitContext.repoRoot,
        branch: gitContext.branch,
      },
      ship,
    };
  }

  async readDiff(filePath: string): Promise<WorkspaceDiffResult> {
    const resolvedPath = this.resolveWorkspacePath(filePath);
    const gitContext = await this.resolveGitContext();

    if (!gitContext.enabled) {
      return {
        path: resolvedPath.relativePath,
        absolutePath: resolvedPath.absolutePath,
        gitEnabled: false,
        changeKind: null,
        reviewState: 'clean',
        staged: false,
        unstaged: false,
        diff: '',
        hunks: [],
        canAccept: false,
        canReject: false,
      };
    }

    const changes = await this.listGitChanges(
      this.getWorkspaceRoot(),
      gitContext,
    );
    const change = changes.find(
      (item) => item.path === resolvedPath.relativePath,
    );

    if (!change) {
      return {
        path: resolvedPath.relativePath,
        absolutePath: resolvedPath.absolutePath,
        gitEnabled: true,
        changeKind: null,
        reviewState: 'clean',
        staged: false,
        unstaged: false,
        diff: '',
        hunks: [],
        canAccept: false,
        canReject: false,
      };
    }

    const [diff, actionDiff] = await Promise.all([
      this.resolveDiffForChange(resolvedPath, change, gitContext),
      this.resolveActionDiffForChange(resolvedPath, change, gitContext),
    ]);

    return {
      path: resolvedPath.relativePath,
      absolutePath: resolvedPath.absolutePath,
      gitEnabled: true,
      changeKind: change.kind,
      reviewState: change.reviewState,
      staged: change.staged,
      unstaged: change.unstaged,
      diff,
      hunks: this.parseDiffHunks(actionDiff).map(
        ({ patch: _patch, ...hunk }) => hunk,
      ),
      canAccept: true,
      canReject: true,
    };
  }

  async acceptDiff(filePath: string): Promise<WorkspaceDiffResult> {
    const resolvedPath = this.resolveWorkspacePath(filePath);
    const gitContext = await this.resolveGitContext();

    if (!gitContext.enabled || !gitContext.repoRoot) {
      throw new BadRequestException(
        'Git 작업공간에서만 변경 리뷰를 지원합니다.',
      );
    }

    const repoRelativePath = this.toPosixPath(
      path.relative(gitContext.repoRoot, resolvedPath.absolutePath),
    );
    await this.runGitCommand(
      ['add', '--', repoRelativePath],
      gitContext.repoRoot,
    );

    return this.readDiff(filePath);
  }

  async rejectDiff(filePath: string): Promise<WorkspaceDiffResult> {
    const resolvedPath = this.resolveWorkspacePath(filePath);
    const gitContext = await this.resolveGitContext();

    if (!gitContext.enabled || !gitContext.repoRoot) {
      throw new BadRequestException(
        'Git 작업공간에서만 변경 리뷰를 지원합니다.',
      );
    }

    const change = await this.readDiff(filePath);
    const repoRelativePath = this.toPosixPath(
      path.relative(gitContext.repoRoot, resolvedPath.absolutePath),
    );

    if (change.changeKind === 'untracked' || change.changeKind === 'added') {
      await this.runGitCommand(
        ['rm', '--cached', '--force', '--', repoRelativePath],
        gitContext.repoRoot,
        [0, 128],
      );
      await fs.rm(resolvedPath.absolutePath, { force: true, recursive: true });
      return this.readDiff(filePath);
    }

    await this.runGitCommand(
      [
        'restore',
        '--source=HEAD',
        '--staged',
        '--worktree',
        '--',
        repoRelativePath,
      ],
      gitContext.repoRoot,
    );

    return this.readDiff(filePath);
  }

  async acceptDiffHunk(
    filePath: string,
    hunkIndex: number,
  ): Promise<WorkspaceDiffResult> {
    const resolvedPath = this.resolveWorkspacePath(filePath);
    const gitContext = await this.resolveGitContext();

    if (!gitContext.enabled || !gitContext.repoRoot) {
      throw new BadRequestException(
        'Git 작업공간에서만 hunk 리뷰를 지원합니다.',
      );
    }

    const changes = await this.listGitChanges(
      this.getWorkspaceRoot(),
      gitContext,
    );
    const change = changes.find(
      (item) => item.path === resolvedPath.relativePath,
    );

    if (!change) {
      throw new NotFoundException('변경된 파일을 찾지 못했습니다.');
    }

    const hunk = await this.resolveHunkPatch(
      resolvedPath,
      change,
      gitContext,
      hunkIndex,
    );

    try {
      await this.applyGitPatch(
        ['apply', '--cached', '--whitespace=nowarn', '--recount'],
        gitContext.repoRoot,
        hunk.patch,
      );
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : '선택한 hunk를 스테이징하지 못했습니다.',
      );
    }

    return this.readDiff(filePath);
  }

  async rejectDiffHunk(
    filePath: string,
    hunkIndex: number,
  ): Promise<WorkspaceDiffResult> {
    const resolvedPath = this.resolveWorkspacePath(filePath);
    const gitContext = await this.resolveGitContext();

    if (!gitContext.enabled || !gitContext.repoRoot) {
      throw new BadRequestException(
        'Git 작업공간에서만 hunk 리뷰를 지원합니다.',
      );
    }

    const changes = await this.listGitChanges(
      this.getWorkspaceRoot(),
      gitContext,
    );
    const change = changes.find(
      (item) => item.path === resolvedPath.relativePath,
    );

    if (!change) {
      throw new NotFoundException('변경된 파일을 찾지 못했습니다.');
    }

    const hunk = await this.resolveHunkPatch(
      resolvedPath,
      change,
      gitContext,
      hunkIndex,
    );

    try {
      await this.applyGitPatch(
        ['apply', '-R', '--whitespace=nowarn', '--recount'],
        gitContext.repoRoot,
        hunk.patch,
      );
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : '선택한 hunk를 되돌리지 못했습니다.',
      );
    }

    return this.readDiff(filePath);
  }

  async commitChanges(message: string): Promise<WorkspaceCommitResult> {
    const commitMessage = message.trim();
    if (!commitMessage) {
      throw new BadRequestException('커밋 메시지를 입력해주세요.');
    }

    const workspaceRoot = this.getWorkspaceRoot();
    const gitContext = await this.resolveGitContext();

    if (!gitContext.enabled || !gitContext.repoRoot) {
      throw new BadRequestException('Git 작업공간에서만 커밋할 수 있습니다.');
    }

    const changes = await this.listGitChanges(workspaceRoot, gitContext);
    const stagedCount = changes.filter((change) => change.staged).length;
    if (stagedCount === 0) {
      throw new BadRequestException(
        '커밋할 staged 변경이 없습니다. accept로 먼저 스테이징해주세요.',
      );
    }

    try {
      await this.runGitCommand(
        ['commit', '-m', commitMessage],
        gitContext.repoRoot,
      );
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : '커밋에 실패했습니다. Git 설정을 확인해주세요.',
      );
    }

    const [headResult, remoteUrl, defaultBaseBranch] = await Promise.all([
      this.runGitCommand(['rev-parse', 'HEAD'], gitContext.repoRoot),
      this.resolveRemoteUrl(gitContext),
      this.resolveDefaultBaseBranch(gitContext),
    ]);

    return {
      ok: true,
      commitSha: headResult.stdout.trim(),
      commitMessage,
      branch: gitContext.branch,
      compareUrl: this.buildCompareUrl(
        remoteUrl,
        defaultBaseBranch,
        gitContext.branch,
      ),
    };
  }

  async createBranch(branchName: string): Promise<WorkspaceBranchResult> {
    const nextBranchName = this.sanitizeBranchName(branchName);
    const gitContext = await this.resolveGitContext();

    if (!gitContext.enabled || !gitContext.repoRoot) {
      throw new BadRequestException(
        'Git 작업공간에서만 브랜치를 만들 수 있습니다.',
      );
    }

    try {
      await this.runGitCommand(
        ['rev-parse', '--verify', '--quiet', nextBranchName],
        gitContext.repoRoot,
        [0, 1],
      ).then((result) => {
        if (result.code === 0) {
          throw new BadRequestException('이미 존재하는 브랜치 이름입니다.');
        }
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
    }

    const startPoint =
      gitContext.branch ||
      (await this.resolveDefaultBaseBranch(gitContext)) ||
      'HEAD';

    await this.runGitCommand(
      ['checkout', '-b', nextBranchName, startPoint],
      gitContext.repoRoot,
    );

    const remoteUrl = await this.resolveRemoteUrl({
      ...gitContext,
      branch: nextBranchName,
    });
    const defaultBaseBranch = await this.resolveDefaultBaseBranch(gitContext);

    return {
      ok: true,
      branch: nextBranchName,
      compareUrl: this.buildCompareUrl(
        remoteUrl,
        defaultBaseBranch,
        nextBranchName,
      ),
    };
  }

  async pushBranch(): Promise<WorkspacePushResult> {
    const gitContext = await this.resolveGitContext();

    if (!gitContext.enabled || !gitContext.repoRoot || !gitContext.branch) {
      throw new BadRequestException('Push할 활성 브랜치를 찾지 못했습니다.');
    }

    await this.runGitCommand(
      ['push', '-u', 'origin', gitContext.branch],
      gitContext.repoRoot,
    );

    const [trackingBranch, remoteUrl, defaultBaseBranch] = await Promise.all([
      this.resolveTrackingBranch(gitContext),
      this.resolveRemoteUrl(gitContext),
      this.resolveDefaultBaseBranch(gitContext),
    ]);

    return {
      ok: true,
      branch: gitContext.branch,
      trackingBranch,
      remoteUrl,
      compareUrl: this.buildCompareUrl(
        remoteUrl,
        defaultBaseBranch,
        gitContext.branch,
      ),
    };
  }
}
