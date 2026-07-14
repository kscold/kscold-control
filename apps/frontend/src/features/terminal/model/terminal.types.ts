import type { Terminal as XTermTerminal } from '@xterm/xterm';
import type { FitAddon } from '@xterm/addon-fit';
import type { Socket } from 'socket.io-client';

/**
 * Terminal Session State
 */
export interface TerminalSession {
  sessionId: string | null;
  isConnected: boolean;
  commandCount: number;
  commandLimit: number;
  workingDirectory: string | null;
  shellPath: string | null;
  claudeBinaryPath: string | null;
  claudeLaunchCommand: string | null;
}

export interface WorkspaceFileRecord {
  path: string;
  relativePath: string;
  absolutePath: string;
  size: number;
  encoding: 'utf8' | 'base64';
  content: string;
  updatedAt: string;
}

export interface WorkspaceFileReference {
  path: string;
  line: number | null;
  absolute: boolean;
}

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

export interface ClaudeRuntimeCheck {
  ok: boolean;
  reason: string | null;
  stdoutLength?: number;
  stderrLength?: number;
  outputLength?: number;
  stdoutPreview?: string;
  stderrPreview?: string;
  outputPreview?: string;
}

export interface ClaudeRuntimeDiagnostics {
  ok: boolean;
  cached: boolean;
  diagnosedAt: string;
  summary: string;
  recommendation: string | null;
  environment: {
    cwd: string;
    binaryPath: string | null;
    home: string | null;
  };
  macOsSignals: {
    quarantine: string | null;
    spctl: string | null;
  };
  checks: {
    version: ClaudeRuntimeCheck;
    interactive: ClaudeRuntimeCheck;
  };
}

/**
 * Terminal Socket Events
 */
export interface TerminalSocketEvents {
  'terminal:session-ready': (data: {
    sessionId: string;
    isReconnect: boolean;
    workingDirectory?: string | null;
    shellPath?: string | null;
    claudeBinaryPath?: string | null;
    claudeLaunchCommand?: string | null;
  }) => void;
  'terminal:output': (data: { type: string; content: string }) => void;
  'terminal:error': (data: { message: string }) => void;
  'terminal:exit': (data: { code: number }) => void;
  'terminal:command-count': (data: {
    count: number;
    limit: number;
    remaining: number;
  }) => void;
  'terminal:limit-reached': (data: { limit: number; count: number }) => void;
}

/**
 * Terminal Refs
 */
export interface TerminalRefs {
  xterm: XTermTerminal | null;
  socket: Socket | null;
  fitAddon: FitAddon | null;
}
