export type WorkspaceFileEncoding = 'utf8' | 'base64';
export type WorkspaceChangeKind =
  'modified' | 'added' | 'deleted' | 'untracked';
export type WorkspaceReviewState =
  'clean' | 'modified' | 'added' | 'deleted' | 'untracked' | 'staged' | 'mixed';

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

export interface GitContext {
  enabled: boolean;
  repoRoot: string | null;
  branch: string | null;
}

export interface ResolvedWorkspacePath {
  absolutePath: string;
  relativePath: string;
}

export interface GitCommandResult {
  stdout: string;
  stderr: string;
  code: number;
}

export interface GitHubRemoteTarget {
  owner: string;
  repo: string;
}

export interface ParsedWorkspaceDiffHunk extends WorkspaceDiffHunk {
  patch: string;
}
