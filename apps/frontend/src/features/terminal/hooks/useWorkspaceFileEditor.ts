import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { workspaceFileService } from '../../../services/api/workspace-file.service';
import type {
  WorkspaceDiffResult,
  WorkspaceFileRecord,
  WorkspaceFileReference,
  WorkspaceGitChange,
  WorkspaceShipStatus,
  WorkspaceTreeNode,
} from '../lib/terminal.types';
import {
  extractWorkspaceFileReferences,
  mergeWorkspaceFileReferences,
} from '../lib/workspace-file.utils';

function toReference(referenceOrPath: WorkspaceFileReference | string) {
  if (typeof referenceOrPath !== 'string') {
    return referenceOrPath;
  }

  const nextPath = referenceOrPath.trim();
  return {
    path: nextPath,
    line: null,
    absolute: nextPath.startsWith('/'),
  } satisfies WorkspaceFileReference;
}

export function useWorkspaceFileEditor() {
  const carryRef = useRef('');
  const draftTemplateRef = useRef({ title: '', body: '' });
  const [references, setReferences] = useState<WorkspaceFileReference[]>([]);
  const [pathInput, setPathInput] = useState('');
  const [activePath, setActivePath] = useState<string | null>(null);
  const [activeReference, setActiveReference] =
    useState<WorkspaceFileReference | null>(null);
  const [activeFile, setActiveFile] = useState<WorkspaceFileRecord | null>(
    null,
  );
  const [tree, setTree] = useState<WorkspaceTreeNode | null>(null);
  const [changes, setChanges] = useState<WorkspaceGitChange[]>([]);
  const [shipStatus, setShipStatus] = useState<WorkspaceShipStatus>({
    gitEnabled: false,
    branch: null,
    defaultBaseBranch: null,
    trackingBranch: null,
    isOnDefaultBranch: false,
    hasRemoteTracking: false,
    remoteUrl: null,
    compareUrl: null,
    changedCount: 0,
    stagedCount: 0,
    lastCommit: null,
    draft: {
      title: '',
      body: '',
      compareUrl: null,
      branch: null,
      baseBranch: null,
      canOpen: false,
    },
  });
  const [gitInfo, setGitInfo] = useState<{
    enabled: boolean;
    rootPath: string | null;
    branch: string | null;
  }>({
    enabled: false,
    rootPath: null,
    branch: null,
  });
  const [diff, setDiff] = useState<WorkspaceDiffResult | null>(null);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTreeLoading, setIsTreeLoading] = useState(false);
  const [isDiffLoading, setIsDiffLoading] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewingHunk, setReviewingHunk] = useState<{
    index: number;
    action: 'stage' | 'revert';
  } | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [branchName, setBranchName] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  const registerOutput = useCallback((content: string) => {
    const mergedContent = `${carryRef.current}${content}`;
    carryRef.current = mergedContent.slice(-400);
    const nextReferences = extractWorkspaceFileReferences(mergedContent);
    if (nextReferences.length === 0) {
      return;
    }

    setReferences((previous) =>
      mergeWorkspaceFileReferences(previous, nextReferences),
    );
  }, []);

  const refreshTree = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setIsTreeLoading(true);
      }
      const nextTree = await workspaceFileService.readTree();
      setTree(nextTree.root);
      setChanges(nextTree.changes);
      setGitInfo(nextTree.git);
      setShipStatus(nextTree.ship);
      setDraftTitle((previous) => {
        const shouldSync =
          !previous.trim() || previous === draftTemplateRef.current.title;
        return shouldSync ? nextTree.ship.draft.title : previous;
      });
      setDraftBody((previous) => {
        const shouldSync =
          !previous.trim() || previous === draftTemplateRef.current.body;
        return shouldSync ? nextTree.ship.draft.body : previous;
      });
      draftTemplateRef.current = {
        title: nextTree.ship.draft.title,
        body: nextTree.ship.draft.body,
      };
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : '워크스페이스 트리를 불러오지 못했습니다.',
      );
    } finally {
      if (!silent) {
        setIsTreeLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void refreshTree();
  }, [refreshTree]);

  const syncSelection = useCallback(
    async (
      referenceOrPath: WorkspaceFileReference | string,
      options?: { suppressMissing?: boolean },
    ) => {
      const reference = toReference(referenceOrPath);

      if (!reference.path) {
        setError('열 파일 경로를 입력해주세요.');
        return;
      }

      setIsLoading(true);
      setIsDiffLoading(true);
      setError(null);
      setActiveReference(reference);
      setActivePath(reference.path);
      setPathInput(reference.path);
      setActiveFile(null);
      setDraft('');

      const [fileResult, diffResult] = await Promise.allSettled([
        workspaceFileService.readFile(reference.path),
        workspaceFileService.readDiff(reference.path),
      ]);

      if (fileResult.status === 'fulfilled') {
        setActiveFile(fileResult.value);
        setDraft(
          fileResult.value.encoding === 'utf8' ? fileResult.value.content : '',
        );
        setActivePath(fileResult.value.path);
        setPathInput(fileResult.value.path);
      } else {
        setActiveFile(null);
        setDraft('');
      }

      if (diffResult.status === 'fulfilled') {
        setDiff(diffResult.value);
        if (fileResult.status !== 'fulfilled') {
          setActivePath(diffResult.value.path);
          setPathInput(diffResult.value.path);
        }
      } else {
        setDiff(null);
      }

      if (fileResult.status === 'rejected') {
        const allowMissingForDeleted =
          diffResult.status === 'fulfilled' &&
          (diffResult.value.changeKind === 'deleted' ||
            options?.suppressMissing === true);
        if (!allowMissingForDeleted) {
          setError(
            fileResult.reason instanceof Error
              ? fileResult.reason.message
              : '파일을 열지 못했습니다.',
          );
        }
      }

      setIsLoading(false);
      setIsDiffLoading(false);
    },
    [],
  );

  const openFile = useCallback(
    async (referenceOrPath: WorkspaceFileReference | string) => {
      await syncSelection(referenceOrPath);
    },
    [syncSelection],
  );

  const saveFile = useCallback(async () => {
    if (!activeFile || activeFile.encoding !== 'utf8') {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const saved = await workspaceFileService.writeFile(
        activeFile.path,
        draft,
      );
      setActiveFile(saved);
      setDraft(saved.content);
      const nextDiff = await workspaceFileService.readDiff(saved.path);
      setDiff(nextDiff);
      await refreshTree(true);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : '파일을 저장하지 못했습니다.',
      );
    } finally {
      setIsSaving(false);
    }
  }, [activeFile, draft, refreshTree]);

  const openManualPath = useCallback(async () => {
    await openFile(pathInput);
  }, [openFile, pathInput]);

  const acceptDiff = useCallback(async () => {
    if (!activePath) {
      return;
    }

    setIsReviewing(true);
    setError(null);

    try {
      const nextDiff = await workspaceFileService.acceptDiff(activePath);
      setDiff(nextDiff);
      await refreshTree(true);
      await syncSelection(activePath);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : '변경 수락에 실패했습니다.',
      );
    } finally {
      setIsReviewing(false);
    }
  }, [activePath, refreshTree, syncSelection]);

  const rejectDiff = useCallback(async () => {
    if (!activePath) {
      return;
    }

    setIsReviewing(true);
    setError(null);

    try {
      const nextDiff = await workspaceFileService.rejectDiff(activePath);
      setDiff(nextDiff);
      await refreshTree(true);
      await syncSelection(activePath, { suppressMissing: true });
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : '변경 되돌리기에 실패했습니다.',
      );
    } finally {
      setIsReviewing(false);
    }
  }, [activePath, refreshTree, syncSelection]);

  const acceptDiffHunk = useCallback(
    async (hunkIndex: number) => {
      if (!activePath) {
        return;
      }

      setReviewingHunk({ index: hunkIndex, action: 'stage' });
      setError(null);

      try {
        const nextDiff = await workspaceFileService.acceptDiffHunk(
          activePath,
          hunkIndex,
        );
        setDiff(nextDiff);
        await refreshTree(true);
        await syncSelection(activePath, { suppressMissing: true });
      } catch (nextError) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : '선택한 hunk 스테이징에 실패했습니다.',
        );
      } finally {
        setReviewingHunk(null);
      }
    },
    [activePath, refreshTree, syncSelection],
  );

  const rejectDiffHunk = useCallback(
    async (hunkIndex: number) => {
      if (!activePath) {
        return;
      }

      setReviewingHunk({ index: hunkIndex, action: 'revert' });
      setError(null);

      try {
        const nextDiff = await workspaceFileService.rejectDiffHunk(
          activePath,
          hunkIndex,
        );
        setDiff(nextDiff);
        await refreshTree(true);
        await syncSelection(activePath, { suppressMissing: true });
      } catch (nextError) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : '선택한 hunk 되돌리기에 실패했습니다.',
        );
      } finally {
        setReviewingHunk(null);
      }
    },
    [activePath, refreshTree, syncSelection],
  );

  const hasUnsavedChanges = useMemo(() => {
    return Boolean(
      activeFile &&
      activeFile.encoding === 'utf8' &&
      draft !== activeFile.content,
    );
  }, [activeFile, draft]);

  const commitChanges = useCallback(async () => {
    const message = commitMessage.trim();
    if (!message) {
      setError('커밋 메시지를 먼저 입력해주세요.');
      return null;
    }

    setIsCommitting(true);
    setError(null);

    try {
      const result = await workspaceFileService.commitChanges(message);
      setCommitMessage('');
      await refreshTree(true);
      if (activePath) {
        await syncSelection(activePath, { suppressMissing: true });
      }
      return result;
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : '커밋에 실패했습니다.',
      );
      return null;
    } finally {
      setIsCommitting(false);
    }
  }, [activePath, commitMessage, refreshTree, syncSelection]);

  const createBranch = useCallback(async () => {
    const nextBranch = branchName.trim();
    if (!nextBranch) {
      setError('브랜치 이름을 입력해주세요.');
      return null;
    }

    setIsCreatingBranch(true);
    setError(null);

    try {
      const result = await workspaceFileService.createBranch(nextBranch);
      setBranchName('');
      await refreshTree(true);
      if (activePath) {
        await syncSelection(activePath, { suppressMissing: true });
      }
      return result;
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : '브랜치 생성에 실패했습니다.',
      );
      return null;
    } finally {
      setIsCreatingBranch(false);
    }
  }, [activePath, branchName, refreshTree, syncSelection]);

  const pushBranch = useCallback(async () => {
    setIsPushing(true);
    setError(null);

    try {
      const result = await workspaceFileService.pushBranch();
      await refreshTree(true);
      return result;
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : '브랜치 push에 실패했습니다.',
      );
      return null;
    } finally {
      setIsPushing(false);
    }
  }, [refreshTree]);

  return {
    references,
    pathInput,
    setPathInput,
    activePath,
    activeReference,
    activeFile,
    tree,
    changes,
    shipStatus,
    gitInfo,
    diff,
    draft,
    setDraft,
    commitMessage,
    setCommitMessage,
    branchName,
    setBranchName,
    draftTitle,
    setDraftTitle,
    draftBody,
    setDraftBody,
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
    registerOutput,
    refreshTree,
    openFile,
    openManualPath,
    saveFile,
    acceptDiff,
    rejectDiff,
    acceptDiffHunk,
    rejectDiffHunk,
    commitChanges,
    createBranch,
    pushBranch,
  };
}
