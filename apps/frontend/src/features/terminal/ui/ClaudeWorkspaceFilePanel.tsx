import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  File,
  FileCode2,
  Folder,
  FolderOpen,
  GitBranch,
  GitCommitHorizontal,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import type {
  WorkspaceDiffResult,
  WorkspaceFileRecord,
  WorkspaceFileReference,
  WorkspaceGitChange,
  WorkspaceReviewState,
  WorkspaceShipStatus,
  WorkspaceTreeNode,
} from '../model/terminal.types';
import {
  getLineOffset,
  getWorkspaceFileDisplayPath,
  parseStoredPaths,
} from '../lib/workspace-file.utils';
import { formatBytes } from '@/shared/lib';

type WorkspaceViewMode = 'diff' | 'editor';

interface ClaudeWorkspaceFilePanelProps {
  workingDirectory: string | null;
  gitEnabled: boolean;
  gitBranch: string | null;
  shipStatus: WorkspaceShipStatus;
  pathInput: string;
  setPathInput: (value: string) => void;
  references: WorkspaceFileReference[];
  recentPaths: string[];
  activePath: string | null;
  activeReference: WorkspaceFileReference | null;
  activeFile: WorkspaceFileRecord | null;
  tree: WorkspaceTreeNode | null;
  changes: WorkspaceGitChange[];
  diff: WorkspaceDiffResult | null;
  draft: string;
  setDraft: (value: string) => void;
  isLoading: boolean;
  isSaving: boolean;
  isTreeLoading: boolean;
  isDiffLoading: boolean;
  isReviewing: boolean;
  reviewingHunk: {
    index: number;
    action: 'stage' | 'revert';
  } | null;
  isCommitting: boolean;
  isPushing: boolean;
  isCreatingBranch: boolean;
  error: string | null;
  hasUnsavedChanges: boolean;
  commitMessage: string;
  setCommitMessage: (value: string) => void;
  branchName: string;
  setBranchName: (value: string) => void;
  draftTitle: string;
  setDraftTitle: (value: string) => void;
  draftBody: string;
  setDraftBody: (value: string) => void;
  onRefreshTree: () => void;
  onOpenManualPath: () => void;
  onOpenReference: (reference: WorkspaceFileReference) => void;
  onOpenPath: (path: string) => void;
  onSave: () => void;
  onAcceptDiff: () => void;
  onRejectDiff: () => void;
  onAcceptDiffHunk: (hunkIndex: number) => void;
  onRejectDiffHunk: (hunkIndex: number) => void;
  onCommit: () => void;
  onCreateBranch: () => void;
  onPushBranch: () => void;
}

function getReviewStateClassName(state: WorkspaceReviewState | null) {
  switch (state) {
    case 'staged':
      return 'border-emerald-300/25 bg-emerald-500/10 text-emerald-100';
    case 'mixed':
      return 'border-amber-300/25 bg-amber-500/10 text-amber-100';
    case 'added':
    case 'untracked':
      return 'border-cyan-300/25 bg-cyan-500/10 text-cyan-100';
    case 'deleted':
      return 'border-rose-300/25 bg-rose-500/10 text-rose-100';
    case 'modified':
      return 'border-orange-300/25 bg-orange-500/10 text-orange-100';
    default:
      return 'border-white/10 bg-white/5 text-slate-300';
  }
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const codeExts = new Set([
    'ts',
    'tsx',
    'js',
    'jsx',
    'mjs',
    'cjs',
    'vue',
    'svelte',
    'py',
    'java',
    'kt',
    'go',
    'rs',
    'rb',
    'php',
    'swift',
    'c',
    'cpp',
    'h',
    'cs',
    'sh',
    'bash',
    'zsh',
    'ps1',
    'bat',
    'sql',
    'graphql',
    'proto',
    'html',
    'css',
    'scss',
    'sass',
    'less',
    'json',
    'yml',
    'yaml',
    'toml',
    'xml',
    'md',
  ]);
  return codeExts.has(ext) ? FileCode2 : File;
}

function getAncestorPaths(filePath: string) {
  const segments = filePath.split('/').filter(Boolean);
  const ancestors: string[] = [];

  for (let index = 0; index < segments.length - 1; index += 1) {
    ancestors.push(segments.slice(0, index + 1).join('/'));
  }

  return ancestors;
}

function buildPullRequestUrl(
  compareUrl: string | null,
  title: string,
  body: string,
) {
  if (!compareUrl) {
    return null;
  }

  try {
    const url = new URL(compareUrl);
    if (title.trim()) {
      url.searchParams.set('title', title.trim());
    }
    if (body.trim()) {
      url.searchParams.set('body', body.trim());
    }
    return url.toString();
  } catch {
    return compareUrl;
  }
}

function WorkspaceTreeBranch({
  node,
  depth,
  openPaths,
  selectedPath,
  onToggle,
  onSelect,
}: {
  node: WorkspaceTreeNode;
  depth: number;
  openPaths: Set<string>;
  selectedPath: string | null;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
}) {
  const isDirectory = node.type === 'directory';
  const open = isDirectory ? openPaths.has(node.path) : false;
  const isSelected = node.path === selectedPath;
  const Icon = isDirectory
    ? open
      ? FolderOpen
      : Folder
    : getFileIcon(node.name);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (isDirectory) {
            onToggle(node.path);
            return;
          }
          onSelect(node.path);
        }}
        style={{ paddingLeft: `${depth * 12 + 10}px` }}
        className={`flex w-full items-center gap-1.5 rounded-xl px-2 py-1.5 text-left text-xs transition ${
          isSelected
            ? 'bg-cyan-500/10 text-cyan-100'
            : 'text-slate-400 hover:bg-white/5 hover:text-white'
        }`}
        title={node.path}
      >
        {isDirectory ? (
          open ? (
            <ChevronDown size={12} className="shrink-0 text-slate-600" />
          ) : (
            <ChevronRight size={12} className="shrink-0 text-slate-600" />
          )
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <Icon
          size={13}
          className={`shrink-0 ${
            isDirectory
              ? 'text-cyan-300'
              : isSelected
                ? 'text-cyan-200'
                : 'text-slate-500'
          }`}
        />
        <span className="truncate">{node.name}</span>
        {node.changed && (
          <span
            className={`ml-auto rounded-full border px-1.5 py-0.5 text-[10px] ${getReviewStateClassName(
              node.reviewState,
            )}`}
          >
            {node.reviewState ?? 'changed'}
          </span>
        )}
      </button>

      {isDirectory && open && node.children?.length ? (
        <div>
          {node.children.map((child) => (
            <WorkspaceTreeBranch
              key={child.path}
              node={child}
              depth={depth + 1}
              openPaths={openPaths}
              selectedPath={selectedPath}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function UnifiedDiffPreview({ diff }: { diff: string }) {
  const lines = diff.split('\n');

  return (
    <div className="overflow-auto rounded-[22px] border border-white/8 bg-[#08111f]">
      <pre className="min-h-[340px] p-4 font-mono text-[12px] leading-6 text-slate-300">
        {lines.map((line, index) => {
          let className = 'block px-2 text-slate-300';
          if (line.startsWith('+++') || line.startsWith('---')) {
            className = 'block px-2 text-cyan-200';
          } else if (line.startsWith('@@')) {
            className = 'block px-2 text-amber-200';
          } else if (line.startsWith('+')) {
            className =
              'block px-2 text-emerald-100 bg-emerald-500/10 border-l border-emerald-300/30';
          } else if (line.startsWith('-')) {
            className =
              'block px-2 text-rose-100 bg-rose-500/10 border-l border-rose-300/30';
          } else if (
            line.startsWith('diff --git') ||
            line.startsWith('index ')
          ) {
            className = 'block px-2 text-slate-500';
          }

          return (
            <span key={`${line}-${index}`} className={className}>
              {line || ' '}
            </span>
          );
        })}
      </pre>
    </div>
  );
}

function DiffHunkReviewPanel({
  hunks,
  reviewingHunk,
  onStage,
  onRevert,
}: {
  hunks: WorkspaceDiffResult['hunks'];
  reviewingHunk: {
    index: number;
    action: 'stage' | 'revert';
  } | null;
  onStage: (hunkIndex: number) => void;
  onRevert: (hunkIndex: number) => void;
}) {
  if (hunks.length === 0) {
    return (
      <div className="rounded-[22px] border border-white/8 bg-slate-950/60 px-4 py-4 text-sm text-slate-400">
        지금은 선택할 unstaged hunk가 없습니다. 이미 staged 상태이거나 파일 전체
        변경만 남아 있을 수 있습니다.
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="claude-diff-hunks">
      {hunks.map((hunk) => {
        const isStageLoading =
          reviewingHunk?.index === hunk.index &&
          reviewingHunk.action === 'stage';
        const isRevertLoading =
          reviewingHunk?.index === hunk.index &&
          reviewingHunk.action === 'revert';

        return (
          <section
            key={hunk.index}
            className="overflow-hidden rounded-[22px] border border-white/8 bg-slate-950/70"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-mono text-xs text-slate-200">
                  {hunk.header}
                </p>
                <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500">
                  <span className="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-2 py-0.5 text-emerald-100">
                    +{hunk.additions}
                  </span>
                  <span className="rounded-full border border-rose-300/20 bg-rose-500/10 px-2 py-0.5 text-rose-100">
                    -{hunk.deletions}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => onStage(hunk.index)}
                  disabled={!hunk.canStage || Boolean(reviewingHunk)}
                  className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-500/10 px-3 py-1.5 text-[11px] text-cyan-100 transition hover:border-cyan-300/30 hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-slate-900 disabled:text-slate-500"
                >
                  {isStageLoading ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <GitCommitHorizontal size={12} />
                  )}
                  <span>Stage Hunk</span>
                </button>
                <button
                  onClick={() => onRevert(hunk.index)}
                  disabled={!hunk.canRevert || Boolean(reviewingHunk)}
                  className="inline-flex items-center gap-2 rounded-full border border-rose-300/20 bg-rose-500/10 px-3 py-1.5 text-[11px] text-rose-100 transition hover:border-rose-300/30 hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-slate-900 disabled:text-slate-500"
                >
                  {isRevertLoading ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <RotateCcw size={12} />
                  )}
                  <span>Revert Hunk</span>
                </button>
              </div>
            </div>

            <UnifiedDiffPreview diff={hunk.preview} />
          </section>
        );
      })}
    </div>
  );
}

export function ClaudeWorkspaceFilePanel({
  workingDirectory,
  gitEnabled,
  gitBranch,
  shipStatus,
  pathInput,
  setPathInput,
  references,
  recentPaths,
  activePath,
  activeReference,
  activeFile,
  tree,
  changes,
  diff,
  draft,
  setDraft,
  isLoading,
  isSaving,
  isTreeLoading,
  isDiffLoading,
  isReviewing,
  reviewingHunk,
  isCommitting,
  isPushing,
  isCreatingBranch,
  error,
  hasUnsavedChanges,
  commitMessage,
  setCommitMessage,
  branchName,
  setBranchName,
  draftTitle,
  setDraftTitle,
  draftBody,
  setDraftBody,
  onRefreshTree,
  onOpenManualPath,
  onOpenReference,
  onOpenPath,
  onSave,
  onAcceptDiff,
  onRejectDiff,
  onAcceptDiffHunk,
  onRejectDiffHunk,
  onCommit,
  onCreateBranch,
  onPushBranch,
}: ClaudeWorkspaceFilePanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [viewMode, setViewMode] = useState<WorkspaceViewMode>('editor');
  const treeStorageKey = useMemo(
    () => `claude-workspace-tree:${workingDirectory || 'workspace'}`,
    [workingDirectory],
  );
  const [openDirectoryPaths, setOpenDirectoryPaths] = useState<string[]>([]);
  const lineCount = useMemo(
    () => Math.max(draft.split('\n').length, 1),
    [draft],
  );
  const hasDiff = Boolean(diff?.diff.trim());
  const openDirectorySet = useMemo(
    () => new Set(openDirectoryPaths),
    [openDirectoryPaths],
  );
  const hasSelectableHunks = Boolean(diff?.hunks.length);
  const pullRequestUrl = useMemo(
    () =>
      buildPullRequestUrl(shipStatus.draft.compareUrl, draftTitle, draftBody),
    [draftBody, draftTitle, shipStatus.draft.compareUrl],
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    setOpenDirectoryPaths(
      parseStoredPaths(window.localStorage.getItem(treeStorageKey)),
    );
  }, [treeStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(
      treeStorageKey,
      JSON.stringify(openDirectoryPaths),
    );
  }, [openDirectoryPaths, treeStorageKey]);

  useEffect(() => {
    if (!tree?.children?.length || openDirectoryPaths.length > 0) {
      return;
    }

    const defaultOpen = tree.children
      .filter((child) => child.type === 'directory')
      .slice(0, 6)
      .map((child) => child.path);
    if (defaultOpen.length > 0) {
      setOpenDirectoryPaths(defaultOpen);
    }
  }, [openDirectoryPaths.length, tree]);

  useEffect(() => {
    if (!activePath) {
      return;
    }

    const ancestorPaths = getAncestorPaths(activePath);
    if (ancestorPaths.length === 0) {
      return;
    }

    setOpenDirectoryPaths((previous) => {
      const merged = new Set(previous);
      ancestorPaths.forEach((entry) => merged.add(entry));
      return [...merged];
    });
  }, [activePath]);

  const handleToggleDirectory = useCallback((path: string) => {
    setOpenDirectoryPaths((previous) =>
      previous.includes(path)
        ? previous.filter((entry) => entry !== path)
        : [...previous, path],
    );
  }, []);

  useEffect(() => {
    if (hasDiff) {
      setViewMode('diff');
      return;
    }

    if (activeFile?.encoding === 'utf8') {
      setViewMode('editor');
    }
  }, [activeFile?.encoding, hasDiff]);

  useEffect(() => {
    if (
      !textareaRef.current ||
      !activeReference?.line ||
      !activeFile ||
      activeFile.encoding !== 'utf8' ||
      viewMode !== 'editor'
    ) {
      return;
    }

    const nextOffset = getLineOffset(draft, activeReference.line);
    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(nextOffset, nextOffset);
    textareaRef.current.scrollTop = Math.max(
      0,
      (activeReference.line - 3) * 22,
    );
  }, [activeFile, activeReference, draft, viewMode]);

  return (
    <section
      className="rounded-3xl border border-white/8 bg-white/5 p-4"
      data-testid="claude-workspace-files"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-500">
            <FileCode2 size={14} />
            <span>Workspace Review</span>
          </div>
          <p className="text-sm leading-6 text-slate-300">
            파일 트리, 변경 리뷰, unified diff, accept/reject를 한 번에 봅니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-slate-300">
            {shipStatus.changedCount} changed
          </span>
          <span className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-slate-300">
            {shipStatus.stagedCount} staged
          </span>
          {gitEnabled && (
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-slate-300">
              <GitBranch size={12} />
              <span>{gitBranch || 'detached'}</span>
            </span>
          )}
          <button
            onClick={onRefreshTree}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-slate-300 transition hover:border-white/20 hover:text-white"
          >
            <RefreshCw
              size={12}
              className={isTreeLoading ? 'animate-spin' : ''}
            />
            <span>refresh</span>
          </button>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <input
          value={pathInput}
          onChange={(event) => setPathInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onOpenManualPath();
            }
          }}
          placeholder="예: apps/frontend/src/App.tsx"
          className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-orange-300/35 focus:outline-none"
        />
        <button
          onClick={onOpenManualPath}
          className="rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 transition hover:border-white/20 hover:bg-slate-900"
        >
          열기
        </button>
      </div>

      {references.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {references.map((reference) => {
            const isActive = reference.path === activePath;
            return (
              <button
                key={`${reference.path}:${reference.line ?? ''}`}
                onClick={() => onOpenReference(reference)}
                className={`rounded-full border px-3 py-1.5 text-left text-xs transition ${
                  isActive
                    ? 'border-orange-300/35 bg-orange-500/10 text-orange-100'
                    : 'border-white/10 bg-slate-950/80 text-slate-300 hover:border-white/20 hover:text-white'
                }`}
              >
                {getWorkspaceFileDisplayPath(reference.path, workingDirectory)}
                {reference.line ? `:${reference.line}` : ''}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-4" data-testid="claude-workspace-recent">
        <div className="mb-2 text-xs uppercase tracking-[0.22em] text-slate-500">
          Recent Files
        </div>
        {recentPaths.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {recentPaths.map((path) => {
              const isActive = path === activePath;
              return (
                <button
                  key={path}
                  onClick={() => onOpenPath(path)}
                  className={`rounded-full border px-3 py-1.5 text-left text-xs transition ${
                    isActive
                      ? 'border-violet-300/35 bg-violet-500/10 text-violet-100'
                      : 'border-white/10 bg-slate-950/80 text-slate-300 hover:border-white/20 hover:text-white'
                  }`}
                  title={path}
                >
                  {getWorkspaceFileDisplayPath(path, workingDirectory)}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            아직 연 파일이 없습니다. 트리나 Review Queue에서 파일을 열면 여기에
            쌓입니다.
          </p>
        )}
      </div>

      {changes.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-xs uppercase tracking-[0.22em] text-slate-500">
            Review Queue
          </div>
          <div className="flex flex-wrap gap-2">
            {changes.map((change) => (
              <button
                key={change.path}
                onClick={() => onOpenPath(change.path)}
                className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs transition ${
                  activePath === change.path
                    ? 'border-cyan-300/35 bg-cyan-500/10 text-cyan-100'
                    : 'border-white/10 bg-slate-950/80 text-slate-300 hover:border-white/20 hover:text-white'
                }`}
              >
                <span
                  className={`rounded-full border px-1.5 py-0.5 ${getReviewStateClassName(
                    change.reviewState,
                  )}`}
                >
                  {change.reviewState}
                </span>
                <span className="font-mono">
                  {getWorkspaceFileDisplayPath(change.path, workingDirectory)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </div>
      )}

      <section
        className="mt-4 rounded-[24px] border border-white/8 bg-slate-950/75 p-4"
        data-testid="claude-ship-controls"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-500">
              <GitCommitHorizontal size={13} />
              <span>Ship Controls</span>
            </div>
            <p className="text-sm leading-6 text-slate-300">
              feature branch 생성부터 push, commit, PR draft 복사까지 한 번에
              이어갈 수 있습니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300">
              base {shipStatus.defaultBaseBranch || 'unknown'}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300">
              branch {shipStatus.branch || 'detached'}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300">
              tracking {shipStatus.trackingBranch || 'not linked'}
            </span>
            <span
              className={`rounded-full border px-3 py-1 ${
                shipStatus.isOnDefaultBranch
                  ? 'border-amber-300/20 bg-amber-500/10 text-amber-100'
                  : 'border-emerald-300/20 bg-emerald-500/10 text-emerald-100'
              }`}
            >
              {shipStatus.isOnDefaultBranch
                ? 'feature branch recommended'
                : 'ready for PR'}
            </span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px_220px]">
          <input
            value={branchName}
            onChange={(event) => setBranchName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onCreateBranch();
              }
            }}
            disabled={!shipStatus.gitEnabled}
            placeholder={
              shipStatus.gitEnabled
                ? 'feat/claude-workspace-review'
                : 'Git workspace에서 branch controls가 활성화됩니다.'
            }
            className="min-w-0 rounded-2xl border border-white/10 bg-[#08111f] px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-cyan-300/35 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            onClick={onCreateBranch}
            disabled={
              !shipStatus.gitEnabled || isCreatingBranch || !branchName.trim()
            }
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-violet-300/20 bg-violet-500/10 px-4 py-3 text-sm text-violet-100 transition hover:border-violet-300/30 hover:bg-violet-500/15 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-slate-900 disabled:text-slate-500"
          >
            {isCreatingBranch ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <GitBranch size={15} />
            )}
            <span>Create Branch</span>
          </button>
          <button
            onClick={onPushBranch}
            disabled={!shipStatus.gitEnabled || isPushing || !shipStatus.branch}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-sky-300/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100 transition hover:border-sky-300/30 hover:bg-sky-500/15 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-slate-900 disabled:text-slate-500"
          >
            {isPushing ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <RefreshCw size={15} />
            )}
            <span>Push Branch</span>
          </button>
        </div>

        <div className="mt-3 rounded-2xl border border-white/8 bg-white/5 px-3 py-3 text-sm text-slate-300">
          {!shipStatus.gitEnabled ? (
            <p>
              현재 세션은 Git 작업공간 정보를 찾지 못했습니다. 브랜치와 PR
              컨트롤은 저장소 루트에서 열면 바로 활성화됩니다.
            </p>
          ) : shipStatus.isOnDefaultBranch ? (
            <p>
              현재 기본 브랜치에 있습니다. PR 흐름으로 보내려면 먼저 feature
              branch를 만드는 편이 안전합니다.
            </p>
          ) : shipStatus.hasRemoteTracking ? (
            <p>
              remote tracking이 연결돼 있어 바로 push 후 compare 페이지로 이어질
              수 있습니다.
            </p>
          ) : (
            <p>
              아직 remote tracking이 없습니다. 브랜치를 만든 뒤 `Push Branch`를
              한 번 눌러 origin에 연결해주세요.
            </p>
          )}
        </div>

        {shipStatus.lastCommit && (
          <div className="mt-4 rounded-2xl border border-white/8 bg-white/5 px-3 py-3 text-sm text-slate-300">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
              Last Commit
            </div>
            <div className="mt-2 font-medium text-white">
              {shipStatus.lastCommit.message}
            </div>
            <div className="mt-1 font-mono text-[11px] text-slate-500">
              {shipStatus.lastCommit.sha.slice(0, 12)}
            </div>
          </div>
        )}

        <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px_220px]">
          <input
            value={commitMessage}
            onChange={(event) => setCommitMessage(event.target.value)}
            onKeyDown={(event) => {
              if (
                (event.metaKey || event.ctrlKey) &&
                event.key.toLowerCase() === 'enter'
              ) {
                event.preventDefault();
                onCommit();
              }
            }}
            placeholder="feat: accept Claude workspace changes"
            className="min-w-0 rounded-2xl border border-white/10 bg-[#08111f] px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-cyan-300/35 focus:outline-none"
          />
          <button
            onClick={onCommit}
            disabled={
              isCommitting ||
              shipStatus.stagedCount === 0 ||
              !commitMessage.trim()
            }
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100 transition hover:border-cyan-300/30 hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-slate-900 disabled:text-slate-500"
          >
            {isCommitting ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <GitCommitHorizontal size={15} />
            )}
            <span>Commit Staged</span>
          </button>
          <button
            onClick={() => {
              if (!pullRequestUrl) {
                return;
              }
              window.open(pullRequestUrl, '_blank', 'noopener,noreferrer');
            }}
            disabled={!pullRequestUrl}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100 transition hover:border-emerald-300/30 hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-slate-900 disabled:text-slate-500"
          >
            <ExternalLink size={15} />
            <span>Open PR</span>
          </button>
        </div>

        <div
          className="mt-4 rounded-[22px] border border-white/8 bg-[#08111f] p-4"
          data-testid="claude-pr-draft"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                Pull Request Draft
              </div>
              <p className="mt-1 text-sm text-slate-400">
                GitHub compare 페이지를 열기 전에 제목과 본문을 다듬어둘 수
                있습니다.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300">
                draft for {shipStatus.branch || 'detached'}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300">
                into {shipStatus.defaultBaseBranch || 'unknown'}
              </span>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            <input
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              placeholder="feat: Claude workspace review flow"
              className="min-w-0 rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-emerald-300/35 focus:outline-none"
            />
            <textarea
              value={draftBody}
              onChange={(event) => setDraftBody(event.target.value)}
              rows={8}
              className="min-h-[180px] rounded-[22px] border border-white/10 bg-slate-950/80 px-4 py-3 font-mono text-[12px] leading-6 text-slate-200 placeholder:text-slate-500 focus:border-emerald-300/35 focus:outline-none"
              placeholder="## Summary&#10;- Describe what changed&#10;&#10;## Testing&#10;- [x] Verified in Claude workspace"
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => navigator.clipboard.writeText(draftTitle.trim())}
              disabled={!draftTitle.trim()}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-slate-300 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Copy size={12} />
              <span>Copy Title</span>
            </button>
            <button
              onClick={() => navigator.clipboard.writeText(draftBody.trim())}
              disabled={!draftBody.trim()}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-slate-300 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Copy size={12} />
              <span>Copy Body</span>
            </button>
            {pullRequestUrl && (
              <button
                onClick={() => navigator.clipboard.writeText(pullRequestUrl)}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-slate-300 transition hover:border-white/20 hover:text-white"
              >
                <Copy size={12} />
                <span className="font-mono">
                  {pullRequestUrl.replace(/^https?:\/\//, '')}
                </span>
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
        <div className="rounded-[24px] border border-white/8 bg-slate-950/75">
          <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                Workspace Explorer
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {tree?.name || 'workspace'}
              </p>
            </div>
            {isTreeLoading && (
              <Loader2 size={14} className="animate-spin text-slate-500" />
            )}
          </div>

          <div
            className="max-h-[560px] overflow-auto px-2 py-2"
            data-testid="claude-workspace-tree"
          >
            {!tree?.children?.length ? (
              <div className="px-4 py-8 text-center text-xs text-slate-500">
                표시할 파일이 없습니다.
              </div>
            ) : (
              tree.children.map((child) => (
                <WorkspaceTreeBranch
                  key={child.path}
                  node={child}
                  depth={0}
                  openPaths={openDirectorySet}
                  selectedPath={activePath}
                  onToggle={handleToggleDirectory}
                  onSelect={onOpenPath}
                />
              ))
            )}
          </div>
        </div>

        <div className="rounded-[24px] border border-white/8 bg-slate-950/75">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-mono text-xs text-slate-200">
                {activePath
                  ? getWorkspaceFileDisplayPath(activePath, workingDirectory)
                  : '파일을 선택하면 여기서 diff와 편집기를 볼 수 있습니다.'}
              </p>
              <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500">
                {activeFile && (
                  <span>
                    {lineCount} lines · {formatBytes(activeFile.size)}
                  </span>
                )}
                {diff?.reviewState && diff.reviewState !== 'clean' && (
                  <span
                    className={`rounded-full border px-2 py-0.5 ${getReviewStateClassName(
                      diff.reviewState,
                    )}`}
                  >
                    {diff.reviewState}
                  </span>
                )}
                {hasUnsavedChanges && (
                  <span className="rounded-full border border-amber-300/20 bg-amber-500/10 px-2 py-0.5 text-amber-100">
                    modified
                  </span>
                )}
              </div>
            </div>

            {activePath && (
              <div className="flex flex-wrap items-center gap-2">
                {hasDiff && (
                  <div className="flex items-center rounded-full border border-white/10 bg-slate-900 p-1">
                    <button
                      onClick={() => setViewMode('diff')}
                      className={`rounded-full px-3 py-1 text-[11px] transition ${
                        viewMode === 'diff'
                          ? 'bg-white/10 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Diff
                    </button>
                    <button
                      onClick={() => setViewMode('editor')}
                      className={`rounded-full px-3 py-1 text-[11px] transition ${
                        viewMode === 'editor'
                          ? 'bg-white/10 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Editor
                    </button>
                  </div>
                )}

                {activeFile && (
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(activeFile.absolutePath)
                    }
                    className="rounded-full border border-white/10 bg-slate-900 px-2.5 py-1.5 text-[11px] text-slate-300 transition hover:border-white/20 hover:text-white"
                    title="절대 경로 복사"
                  >
                    <span className="inline-flex items-center gap-1">
                      <Copy size={12} />
                      path
                    </span>
                  </button>
                )}
                {activeFile?.encoding === 'utf8' && (
                  <button
                    onClick={onSave}
                    disabled={!hasUnsavedChanges || isSaving}
                    className="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] text-emerald-100 transition hover:border-emerald-300/30 hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-slate-900 disabled:text-slate-500"
                  >
                    <span className="inline-flex items-center gap-1">
                      {isSaving ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Save size={12} />
                      )}
                      save
                    </span>
                  </button>
                )}
                {diff?.canAccept && (
                  <button
                    onClick={onAcceptDiff}
                    disabled={isReviewing}
                    className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-2.5 py-1.5 text-[11px] text-cyan-100 transition hover:border-cyan-300/30 hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="inline-flex items-center gap-1">
                      {isReviewing ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <GitCommitHorizontal size={12} />
                      )}
                      accept
                    </span>
                  </button>
                )}
                {diff?.canReject && (
                  <button
                    onClick={onRejectDiff}
                    disabled={isReviewing}
                    className="rounded-full border border-rose-300/20 bg-rose-500/10 px-2.5 py-1.5 text-[11px] text-rose-100 transition hover:border-rose-300/30 hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="inline-flex items-center gap-1">
                      {isReviewing ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <RotateCcw size={12} />
                      )}
                      reject
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="min-h-[360px] p-4">
            {isLoading || isDiffLoading ? (
              <div className="flex min-h-[320px] items-center justify-center">
                <Loader2 size={20} className="animate-spin text-slate-500" />
              </div>
            ) : !activePath ? (
              <div className="flex min-h-[320px] items-center justify-center px-6 py-8 text-center">
                <div>
                  <Sparkles size={28} className="mx-auto text-slate-600" />
                  <p className="mt-3 text-sm text-slate-400">
                    왼쪽 트리나 Review Queue에서 파일을 고르면 diff와 에디터가
                    함께 열립니다.
                  </p>
                </div>
              </div>
            ) : viewMode === 'diff' && hasDiff ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-500">
                  <GitBranch size={13} />
                  <span>Unstaged Hunk Review</span>
                </div>
                <DiffHunkReviewPanel
                  hunks={diff?.hunks ?? []}
                  reviewingHunk={reviewingHunk}
                  onStage={onAcceptDiffHunk}
                  onRevert={onRejectDiffHunk}
                />

                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-500">
                  <GitCommitHorizontal size={13} />
                  <span>Unified Diff Preview</span>
                </div>
                {!hasSelectableHunks && diff?.staged && (
                  <div className="rounded-[22px] border border-emerald-300/15 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                    이 파일은 이미 staged 상태입니다. 여기서는 전체 diff만 보고,
                    추가 변경은 에디터나 파일 단위 accept/reject로 이어가면
                    됩니다.
                  </div>
                )}
                <UnifiedDiffPreview diff={diff?.diff ?? ''} />
              </div>
            ) : !activeFile ? (
              <div className="flex min-h-[320px] items-center justify-center px-6 py-8 text-center">
                <div>
                  <ExternalLink size={28} className="mx-auto text-slate-600" />
                  <p className="mt-3 text-sm text-slate-400">
                    현재 파일 내용은 없지만 변경 리뷰 정보는 남아 있습니다.
                  </p>
                </div>
              </div>
            ) : activeFile.encoding === 'base64' ? (
              <div className="flex min-h-[320px] items-center justify-center px-6 py-8 text-center">
                <div>
                  <ExternalLink size={28} className="mx-auto text-slate-600" />
                  <p className="mt-3 text-sm text-slate-400">
                    이 파일은 바이너리라 웹 에디터에서 직접 수정할 수 없습니다.
                  </p>
                </div>
              </div>
            ) : (
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    (event.metaKey || event.ctrlKey) &&
                    event.key.toLowerCase() === 's'
                  ) {
                    event.preventDefault();
                    onSave();
                  }
                }}
                spellCheck={false}
                className="min-h-[360px] w-full resize-y rounded-[22px] border border-white/8 bg-[#08111f] px-4 py-4 font-mono text-[13px] leading-[22px] text-slate-100 outline-none"
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
