import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Upload,
  FolderUp,
  Loader2,
  RefreshCw,
  RotateCcw,
  Filter,
} from 'lucide-react';
import { repositoryService } from '@/entities/project';
import {
  filterFiles,
  formatBytes,
  chunkFiles,
  type FilterStats,
} from '../lib/file-filter';
import type {
  ClientFile,
  CreateUploadSessionInput,
  RepositoryProject,
  RepositoryUploadActivity,
  RepositoryUploadSession,
} from '@/entities/project';

interface UploadDropzoneProps {
  project: RepositoryProject;
  onUploaded: () => void;
  onUploadActivityChange?: (activity: RepositoryUploadActivity | null) => void;
}

interface PendingUploadBatch {
  index: number;
  files: ClientFile[];
  totalFiles: number;
  totalBytes: number;
  fileMetas: Array<{
    relativePath: string;
    size: number;
  }>;
}

interface PendingUpload {
  kept: ClientFile[];
  stats: FilterStats;
  batches: PendingUploadBatch[];
  manifestDigest: string;
}

function buildManifestDigest(files: ClientFile[]) {
  const sorted = [...files].sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath),
  );

  let hash = 2166136261;
  for (const file of sorted) {
    const value = `${file.relativePath}:${file.file.size}|`;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
  }

  return `m${(hash >>> 0).toString(36)}-${sorted.length}`;
}

function buildPendingUpload(
  kept: ClientFile[],
  stats: FilterStats,
): PendingUpload {
  const rawBatches = chunkFiles(kept, 50, 8 * 1024 * 1024);
  const batches = rawBatches.map((files, index) => ({
    index,
    files,
    totalFiles: files.length,
    totalBytes: files.reduce((sum, file) => sum + file.file.size, 0),
    fileMetas: files.map((file) => ({
      relativePath: file.relativePath,
      size: file.file.size,
    })),
  }));

  return {
    kept,
    stats,
    batches,
    manifestDigest: buildManifestDigest(kept),
  };
}

function isSessionCompatible(
  session: RepositoryUploadSession | null,
  pendingUpload: PendingUpload | null,
) {
  if (!session || !pendingUpload) {
    return false;
  }

  return (
    session.manifestDigest === pendingUpload.manifestDigest &&
    session.totalFiles === pendingUpload.kept.length &&
    session.totalBytes === pendingUpload.stats.totalSize &&
    session.batchTotal === pendingUpload.batches.length
  );
}

function createSessionPayload(
  pendingUpload: PendingUpload,
): CreateUploadSessionInput {
  return {
    replace: true,
    totalFiles: pendingUpload.kept.length,
    totalBytes: pendingUpload.stats.totalSize,
    filteredCount: pendingUpload.stats.filtered,
    manifestDigest: pendingUpload.manifestDigest,
    batches: pendingUpload.batches.map((batch) => ({
      index: batch.index,
      totalFiles: batch.totalFiles,
      totalBytes: batch.totalBytes,
      files: batch.fileMetas,
    })),
  };
}

function getOptimisticProgress(
  session: RepositoryUploadSession,
  batchIndex: number | null,
  transportProgress: number | null,
) {
  const totalFiles = Math.max(session.totalFiles, 1);
  const baseFiles = session.uploadedCount;

  if (
    batchIndex === null ||
    transportProgress === null ||
    transportProgress <= 0 ||
    transportProgress > 100
  ) {
    return Math.floor((baseFiles / totalFiles) * 100);
  }

  const batch = session.batches.find((item) => item.index === batchIndex);
  if (!batch) {
    return Math.floor((baseFiles / totalFiles) * 100);
  }

  const remainingFiles = Math.max(batch.totalFiles - batch.uploadedCount, 0);
  const optimisticFiles =
    baseFiles + Math.floor((remainingFiles * transportProgress) / 100);

  return Math.min(99, Math.floor((optimisticFiles / totalFiles) * 100));
}

function buildActivityFromSession(
  project: RepositoryProject,
  session: RepositoryUploadSession,
  options?: {
    phase?: RepositoryUploadActivity['phase'];
    message?: string;
    error?: string | null;
    batchIndex?: number | null;
    transportProgress?: number | null;
  },
): RepositoryUploadActivity {
  const phase =
    options?.phase ??
    (session.status === 'completed'
      ? 'success'
      : session.status === 'partial_failed'
        ? 'paused'
        : session.status === 'uploading'
          ? 'uploading'
          : 'preparing');

  const currentBatchIndex =
    options?.batchIndex ?? session.currentBatchIndex ?? null;
  const transportProgress = options?.transportProgress ?? null;
  const progress =
    phase === 'uploading'
      ? getOptimisticProgress(session, currentBatchIndex, transportProgress)
      : Math.floor(
          (session.uploadedCount / Math.max(session.totalFiles, 1)) * 100,
        );

  const defaultMessage =
    session.status === 'completed'
      ? `${session.totalFiles}개 파일 업로드가 완료되었습니다.`
      : session.status === 'partial_failed'
        ? '업로드가 일부 실패했습니다. 같은 폴더를 다시 선택하면 실패/미완료 배치만 이어서 보낼 수 있습니다.'
        : session.status === 'uploading'
          ? '업로드 세션이 진행 중입니다.'
          : '업로드 세션을 준비하고 있습니다.';

  return {
    projectId: project.id,
    projectName: project.name,
    phase,
    progress: Math.max(progress, phase === 'success' ? 100 : 3),
    uploadedCount: session.uploadedCount,
    totalFiles: session.totalFiles,
    totalBytes: session.totalBytes,
    filteredCount: session.filteredCount,
    batchCurrent: currentBatchIndex !== null ? currentBatchIndex + 1 : 0,
    batchTotal: session.batchTotal,
    message: options?.message ?? defaultMessage,
    error: options?.error ?? null,
    sessionId: session.id,
    sessionStatus: session.status,
    failedFiles: session.failedFiles,
    transportProgress,
    resumable: session.status !== 'completed',
  };
}

export function UploadDropzone({
  project,
  onUploaded,
  onUploadActivityChange,
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastStats, setLastStats] = useState<FilterStats | null>(null);
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(
    null,
  );
  const [serverSession, setServerSession] =
    useState<RepositoryUploadSession | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [batchInfo, setBatchInfo] = useState<{
    current: number;
    total: number;
  } | null>(null);

  const publishActivity = (
    next: Omit<RepositoryUploadActivity, 'projectId' | 'projectName'> | null,
  ) => {
    if (!next) {
      onUploadActivityChange?.(null);
      return;
    }

    onUploadActivityChange?.({
      projectId: project.id,
      projectName: project.name,
      ...next,
    });
  };

  const loadLatestSession = async () => {
    setLoadingSession(true);
    try {
      const latest = await repositoryService.getLatestUploadSession(project.id);
      setServerSession(latest);

      if (latest && latest.status !== 'completed') {
        const activity = buildActivityFromSession(project, latest, {
          phase:
            latest.status === 'partial_failed' ||
            latest.status === 'uploading' ||
            latest.status === 'pending'
              ? 'paused'
              : 'preparing',
        });
        publishActivity(activity);
        setProgress(activity.progress);
      } else {
        publishActivity(null);
      }
    } catch (sessionError) {
      console.error('Failed to load repository upload session:', sessionError);
    } finally {
      setLoadingSession(false);
    }
  };

  useEffect(() => {
    setDragOver(false);
    setScanning(false);
    setScanCount(0);
    setUploading(false);
    setProgress(0);
    setError(null);
    setLastStats(null);
    setPendingUpload(null);
    setBatchInfo(null);
    setServerSession(null);
    void loadLatestSession();
  }, [project.id]);

  const handleFiles = useCallback(
    async (fileList: FileList) => {
      const allFiles: ClientFile[] = Array.from(fileList).map((f) => ({
        relativePath: stripTopFolder(
          (f as File & { webkitRelativePath?: string }).webkitRelativePath ||
            f.name,
        ),
        file: f,
      }));

      setScanCount(allFiles.length);
      const { kept, stats } = filterFiles(allFiles);
      setScanning(false);
      setLastStats(stats);
      setError(null);

      if (kept.length === 0) {
        setPendingUpload(null);
        setProgress(0);
        setError('업로드할 파일이 없습니다 (전부 필터링됨)');
        if (inputRef.current) {
          inputRef.current.value = '';
        }
        return;
      }

      const nextPendingUpload = buildPendingUpload(kept, stats);
      setPendingUpload(nextPendingUpload);

      if (
        serverSession &&
        isSessionCompatible(serverSession, nextPendingUpload) &&
        serverSession.status !== 'completed'
      ) {
        const activity = buildActivityFromSession(project, serverSession, {
          phase: 'paused',
          message:
            '같은 폴더가 다시 선택되었습니다. 남은 배치만 이어서 업로드할 수 있습니다.',
        });
        publishActivity(activity);
        setProgress(activity.progress);
      } else {
        publishActivity(null);
        setProgress(0);
      }

      if (inputRef.current) {
        inputRef.current.value = '';
      }
    },
    [serverSession, project],
  );

  const startUpload = async () => {
    if (!pendingUpload) {
      return;
    }

    setUploading(true);
    setError(null);

    let activeSession =
      serverSession &&
      isSessionCompatible(serverSession, pendingUpload) &&
      serverSession.status !== 'completed'
        ? serverSession
        : null;

    try {
      if (!activeSession) {
        publishActivity({
          phase: 'preparing',
          progress: 3,
          uploadedCount: 0,
          totalFiles: pendingUpload.kept.length,
          totalBytes: pendingUpload.stats.totalSize,
          filteredCount: pendingUpload.stats.filtered,
          batchCurrent: 0,
          batchTotal: pendingUpload.batches.length,
          message: '서버 업로드 세션을 준비하고 있습니다.',
          error: null,
          sessionId: null,
          sessionStatus: null,
          failedFiles: [],
          transportProgress: null,
          resumable: false,
        });

        activeSession = await repositoryService.createUploadSession(
          project.id,
          createSessionPayload(pendingUpload),
        );
      }

      setServerSession(activeSession);

      const remainingBatches = activeSession.batches.filter(
        (batch) => batch.status !== 'completed',
      );

      if (remainingBatches.length === 0) {
        const successActivity = buildActivityFromSession(
          project,
          activeSession,
          {
            phase: 'success',
          },
        );
        setProgress(100);
        publishActivity(successActivity);
        setPendingUpload(null);
        onUploaded();
        return;
      }

      for (const batch of remainingBatches) {
        const localBatch = pendingUpload.batches[batch.index];
        if (!localBatch) {
          throw new Error(
            '선택한 폴더와 서버 업로드 세션이 다릅니다. 폴더를 다시 선택해주세요.',
          );
        }

        setBatchInfo({
          current: batch.index + 1,
          total: activeSession.batchTotal,
        });

        const syncingActivity = buildActivityFromSession(
          project,
          activeSession,
          {
            phase: 'uploading',
            batchIndex: batch.index,
            transportProgress: 0,
            message:
              batch.status === 'failed'
                ? `실패한 배치 ${batch.index + 1}/${activeSession.batchTotal} 재시도 중입니다.`
                : `배치 ${batch.index + 1}/${activeSession.batchTotal} 업로드 중입니다.`,
          },
        );
        setProgress(syncingActivity.progress);
        publishActivity(syncingActivity);

        const result = await repositoryService.uploadSessionBatch(
          project.id,
          activeSession.id,
          batch.index,
          localBatch.files,
          {
            onProgress: (transportProgress) => {
              const inFlightActivity = buildActivityFromSession(
                project,
                activeSession!,
                {
                  phase: 'uploading',
                  batchIndex: batch.index,
                  transportProgress,
                  message: `배치 ${batch.index + 1}/${activeSession!.batchTotal} 전송 중입니다.`,
                },
              );
              setProgress(inFlightActivity.progress);
              publishActivity(inFlightActivity);
            },
          },
        );

        activeSession = result.session;
        setServerSession(activeSession);

        const batchActivity = buildActivityFromSession(project, activeSession, {
          phase:
            activeSession.status === 'completed'
              ? 'success'
              : activeSession.status === 'partial_failed'
                ? 'paused'
                : 'uploading',
          message:
            activeSession.status === 'completed'
              ? `${activeSession.totalFiles}개 파일 업로드가 완료되었습니다.`
              : activeSession.status === 'partial_failed'
                ? '일부 파일 쓰기에 실패했습니다. 같은 폴더로 다시 시도하면 실패/미완료 배치만 이어서 전송합니다.'
                : `배치 ${batch.index + 1}/${activeSession.batchTotal} 업로드를 마쳤습니다.`,
        });
        setProgress(batchActivity.progress);
        publishActivity(batchActivity);
      }

      if (activeSession.status === 'completed') {
        setProgress(100);
        setPendingUpload(null);
        onUploaded();
      }
    } catch (uploadError) {
      const message =
        uploadError instanceof Error ? uploadError.message : '업로드 실패';
      setError(message);

      if (activeSession?.id) {
        try {
          const latestSession = await repositoryService.getUploadSession(
            project.id,
            activeSession.id,
          );

          if (latestSession) {
            setServerSession(latestSession);
            const pausedActivity = buildActivityFromSession(
              project,
              latestSession,
              {
                phase:
                  latestSession.status === 'partial_failed' ||
                  latestSession.status === 'uploading' ||
                  latestSession.status === 'pending'
                    ? 'paused'
                    : 'error',
                error: message,
                message:
                  latestSession.status === 'completed'
                    ? `${latestSession.totalFiles}개 파일 업로드가 완료되었습니다.`
                    : '업로드가 중단되었습니다. 같은 폴더를 다시 선택하면 남은 배치만 이어서 업로드할 수 있습니다.',
              },
            );
            setProgress(pausedActivity.progress);
            publishActivity(pausedActivity);
          }
        } catch (sessionError) {
          console.error(
            'Failed to refresh upload session after error:',
            sessionError,
          );
          publishActivity({
            phase: 'error',
            progress,
            uploadedCount: 0,
            totalFiles: pendingUpload.kept.length,
            totalBytes: pendingUpload.stats.totalSize,
            filteredCount: pendingUpload.stats.filtered,
            batchCurrent: batchInfo?.current ?? 0,
            batchTotal: pendingUpload.batches.length,
            message: '업로드 중 오류가 발생했습니다.',
            error: message,
            sessionId: activeSession.id,
            sessionStatus: activeSession.status,
            failedFiles: [],
            transportProgress: null,
            resumable: true,
          });
        }
      } else {
        publishActivity({
          phase: 'error',
          progress: 0,
          uploadedCount: 0,
          totalFiles: pendingUpload.kept.length,
          totalBytes: pendingUpload.stats.totalSize,
          filteredCount: pendingUpload.stats.filtered,
          batchCurrent: 0,
          batchTotal: pendingUpload.batches.length,
          message: '업로드 세션 생성 중 오류가 발생했습니다.',
          error: message,
          sessionId: null,
          sessionStatus: null,
          failedFiles: [],
          transportProgress: null,
          resumable: false,
        });
      }
    } finally {
      setUploading(false);
      setBatchInfo(null);
    }
  };

  const resumableSelection =
    pendingUpload &&
    serverSession &&
    isSessionCompatible(serverSession, pendingUpload) &&
    serverSession.status !== 'completed';
  const remainingBatchCount = resumableSelection
    ? serverSession.batches.filter((batch) => batch.status !== 'completed')
        .length
    : (pendingUpload?.batches.length ?? 0);

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setDragOver(false);
          setScanning(true);
          setScanCount(0);
          setPendingUpload(null);
          setError(null);
          await collectFromDataTransfer(e.dataTransfer, handleFiles);
        }}
        onClick={() => !uploading && !scanning && inputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all ${
          dragOver
            ? 'border-blue-500 bg-blue-950/20'
            : 'border-gray-700 hover:border-gray-600'
        } ${uploading ? 'pointer-events-none' : ''}`}
      >
        {uploading ? (
          <>
            <Loader2 size={40} className="mx-auto animate-spin text-blue-400" />
            <p className="mt-4 text-sm font-semibold text-white">
              업로드 중... {progress}%
              {batchInfo && (
                <span className="ml-2 text-xs text-gray-400">
                  (배치 {batchInfo.current}/{batchInfo.total})
                </span>
              )}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              서버에 반영된 배치 기준 진행률과 현재 전송 중인 배치가 함께
              표시됩니다.
            </p>
            <div className="mx-auto mt-3 h-1.5 max-w-xs rounded-full bg-gray-800">
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </>
        ) : scanning ? (
          <>
            <Loader2
              size={40}
              className="mx-auto animate-spin text-violet-400"
            />
            <p className="mt-4 text-sm font-semibold text-white">
              파일 분석 중...
            </p>
            {scanCount > 0 && (
              <p className="mt-1 text-xs text-gray-400">
                {scanCount.toLocaleString()}개 파일 발견
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              불필요한 파일 자동 제외 처리 중
            </p>
          </>
        ) : (
          <>
            <FolderUp size={40} className="mx-auto text-gray-500" />
            <p className="mt-4 text-sm text-white">
              폴더를 드롭하거나 클릭하여 선택
            </p>
            <p className="mt-1 text-xs text-gray-500">
              node_modules / .git / __pycache__ 등 자동 제외
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          // @ts-expect-error - webkitdirectory 비표준
          webkitdirectory=""
          directory=""
          className="hidden"
          onChange={async (e) => {
            if (!e.target.files) return;
            setScanning(true);
            setScanCount(0);
            setPendingUpload(null);
            setError(null);
            await handleFiles(e.target.files);
          }}
        />
      </div>

      {serverSession &&
        serverSession.status !== 'completed' &&
        !pendingUpload &&
        !uploading && (
          <div className="rounded-xl border border-blue-500/20 bg-blue-950/20 p-4 text-sm text-blue-50">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">
                  재개 가능한 업로드 세션이 남아 있습니다
                </p>
                <p className="mt-1 text-xs text-blue-100/80">
                  서버 반영 {serverSession.uploadedCount}/
                  {serverSession.totalFiles}개 · 실패{' '}
                  {serverSession.failedCount}개 · 마지막 활동{' '}
                  {new Date(serverSession.lastActivityAt).toLocaleString(
                    'ko-KR',
                  )}
                </p>
                <p className="mt-2 text-xs text-blue-100/80">
                  같은 폴더를 다시 선택하면 실패/미완료 배치만 이어서
                  업로드합니다.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void loadLatestSession()}
                disabled={loadingSession}
                className="inline-flex items-center gap-2 rounded-lg border border-blue-200/20 px-3 py-2 text-xs font-medium text-blue-50 transition hover:bg-white/5 disabled:opacity-50"
              >
                <RefreshCw
                  size={14}
                  className={loadingSession ? 'animate-spin' : ''}
                />
                세션 새로고침
              </button>
            </div>

            {serverSession.failedFiles.length > 0 && (
              <div className="mt-3 rounded-lg border border-white/10 bg-black/10 p-3 text-xs text-blue-100/85">
                실패 파일: {serverSession.failedFiles.slice(0, 8).join(', ')}
                {serverSession.failedFiles.length > 8 && (
                  <span> 외 {serverSession.failedFiles.length - 8}개</span>
                )}
              </div>
            )}
          </div>
        )}

      {pendingUpload && !uploading && (
        <div
          className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 text-sm text-amber-50"
          data-testid="repository-upload-ready"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold">
                {resumableSelection
                  ? '이어올리기 준비 완료'
                  : '업로드 준비 완료'}
              </p>
              <p className="mt-1 text-xs text-amber-100/80">
                보존 {pendingUpload.stats.kept}개 · 제외{' '}
                {pendingUpload.stats.filtered}개 · 크기{' '}
                {formatBytes(pendingUpload.stats.totalSize)} · 배치{' '}
                {pendingUpload.batches.length}개
              </p>
              <p className="mt-2 text-xs text-amber-100/80">
                {resumableSelection
                  ? `서버에 남아 있는 세션과 일치합니다. 남은 ${remainingBatchCount}개 배치만 이어서 보냅니다.`
                  : '아직 서버로 전송되진 않았습니다. 아래 버튼을 눌러야 실제 업로드가 시작됩니다.'}
              </p>
              {pendingUpload.stats.filteredDirs.size > 0 && (
                <div className="mt-2 text-xs text-amber-100/70">
                  제외된 폴더:{' '}
                  {Array.from(pendingUpload.stats.filteredDirs).join(', ')}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={startUpload}
                className="rounded-lg bg-amber-400 px-3 py-2 text-xs font-semibold text-black transition hover:bg-amber-300"
              >
                {resumableSelection ? '남은 배치 이어올리기' : '업로드 시작'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingUpload(null);
                  setError(null);
                  setProgress(0);
                }}
                className="rounded-lg border border-amber-200/20 px-3 py-2 text-xs font-medium text-amber-50 transition hover:bg-white/5"
              >
                선택 취소
              </button>
            </div>
          </div>
        </div>
      )}

      {lastStats && !pendingUpload && !uploading && !scanning && (
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3 text-xs text-gray-400">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Filter size={11} className="text-gray-500" />
            <span className="font-medium text-gray-300">마지막 분석 결과</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded bg-gray-800/60 p-1.5">
              <div className="text-green-400 font-semibold">
                {lastStats.kept.toLocaleString()}
              </div>
              <div className="text-gray-500 mt-0.5">업로드</div>
            </div>
            <div className="rounded bg-gray-800/60 p-1.5">
              <div className="text-red-400 font-semibold">
                {lastStats.filtered.toLocaleString()}
              </div>
              <div className="text-gray-500 mt-0.5">제외</div>
            </div>
            <div className="rounded bg-gray-800/60 p-1.5">
              <div className="text-blue-400 font-semibold">
                {formatBytes(lastStats.totalSize)}
              </div>
              <div className="text-gray-500 mt-0.5">총 크기</div>
            </div>
          </div>
          {lastStats.filtered > 0 && (
            <div className="mt-2 space-y-0.5 text-gray-500">
              {lastStats.filteredByDir > 0 && (
                <div>
                  · 제외 폴더({lastStats.filteredByDir.toLocaleString()}개):{' '}
                  {Array.from(lastStats.filteredDirs).slice(0, 5).join(', ')}
                  {lastStats.filteredDirs.size > 5
                    ? ` 외 ${lastStats.filteredDirs.size - 5}개`
                    : ''}
                </div>
              )}
              {lastStats.filteredByExt > 0 && (
                <div>
                  · 빌드산출물·바이너리·이미지(
                  {lastStats.filteredByExt.toLocaleString()}개) 제외
                </div>
              )}
              {lastStats.filteredBySize > 0 && (
                <div>
                  · 1MB 초과 대용량 파일(
                  {lastStats.filteredBySize.toLocaleString()}개) 제외
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {serverSession &&
        serverSession.status !== 'completed' &&
        pendingUpload &&
        !resumableSelection && (
          <div className="rounded-lg border border-violet-500/20 bg-violet-950/20 px-3 py-2 text-xs text-violet-100">
            현재 선택한 폴더는 서버에 남아 있는 미완료 업로드 세션과 다릅니다.
            업로드를 시작하면 새 세션으로 처리합니다.
          </div>
        )}

      {error && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {serverSession?.status !== 'completed' &&
      serverSession?.failedFiles.length ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-violet-500/20 bg-violet-950/20 px-4 py-2 text-sm text-violet-50 hover:bg-violet-900/30"
        >
          <RotateCcw size={16} />
          같은 폴더 다시 선택해서 실패 배치 재시도
        </button>
      ) : null}

      <button
        onClick={() => {
          repositoryService.downloadArchive(project.id);
        }}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800"
      >
        <Upload size={16} className="rotate-180" />
        tar.gz로 다운로드
      </button>
    </div>
  );
}

function stripTopFolder(p: string): string {
  const parts = p.split('/');
  return parts.length > 1 ? parts.slice(1).join('/') : p;
}

async function collectFromDataTransfer(
  dt: DataTransfer,
  handler: (files: FileList) => Promise<void>,
) {
  const items = dt.items;
  if (!items) {
    if (dt.files) await handler(dt.files);
    return;
  }

  const allFiles: File[] = [];
  const tasks: Promise<void>[] = [];

  for (let i = 0; i < items.length; i += 1) {
    const entry = (
      items[i] as DataTransferItem & {
        webkitGetAsEntry?: () => FileSystemEntry | null;
      }
    ).webkitGetAsEntry?.();
    if (entry) {
      tasks.push(walkEntry(entry, '', allFiles));
    }
  }

  await Promise.all(tasks);

  const reconstructed = new DataTransfer();
  allFiles.forEach((file) => reconstructed.items.add(file));
  await handler(reconstructed.files);
}

function walkEntry(
  entry: FileSystemEntry,
  parentPath: string,
  out: File[],
): Promise<void> {
  return new Promise((resolve) => {
    if (entry.isFile) {
      (entry as FileSystemFileEntry).file((file) => {
        Object.defineProperty(file, 'webkitRelativePath', {
          value: parentPath ? `${parentPath}/${file.name}` : file.name,
        });
        out.push(file);
        resolve();
      });
      return;
    }

    if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      const allEntries: FileSystemEntry[] = [];
      const readBatch = () => {
        reader.readEntries(async (entries) => {
          if (entries.length === 0) {
            await Promise.all(
              allEntries.map((child) =>
                walkEntry(
                  child,
                  parentPath ? `${parentPath}/${entry.name}` : entry.name,
                  out,
                ),
              ),
            );
            resolve();
            return;
          }

          allEntries.push(...entries);
          readBatch();
        });
      };
      readBatch();
      return;
    }

    resolve();
  });
}
