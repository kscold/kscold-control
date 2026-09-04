import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Loader2,
  Upload,
  Code2,
  AlertTriangle,
  X,
  History,
  FolderTree,
  FileCode2,
} from 'lucide-react';
import { useProjectTree } from '../model/useProjectTree';
import { formatBytes } from '@/shared/lib';
import { FileTreeView } from './FileTreeView';
import { CodeViewer } from './CodeViewer';
import { UploadDropzone } from './UploadDropzone';
import { VersionList } from './VersionList';
import type {
  RepositoryProject,
  RepositoryUploadActivity,
} from '@/entities/project';

interface ProjectBrowserProps {
  project: RepositoryProject;
  onUploaded: () => void;
}

type Tab = 'browse' | 'upload' | 'versions';

export function ProjectBrowser({ project, onUploaded }: ProjectBrowserProps) {
  const [tab, setTab] = useState<Tab>('browse');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [mobileTreeOpen, setMobileTreeOpen] = useState(true);
  const [uploadActivity, setUploadActivity] =
    useState<RepositoryUploadActivity | null>(null);
  const { tree, loading, reload } = useProjectTree(project.id);
  const isUploading =
    uploadActivity?.phase === 'preparing' ||
    uploadActivity?.phase === 'uploading';

  useEffect(() => {
    setTab('browse');
    setSelectedPath(null);
    setMobileTreeOpen(true);
    setUploadActivity(null);
  }, [project.id]);

  const handleSelectFile = (path: string | null) => {
    setSelectedPath(path);
    if (path && typeof window !== 'undefined' && window.innerWidth < 1024) {
      setMobileTreeOpen(false);
    }
  };

  const selectedFileName = selectedPath
    ? (selectedPath.split('/').filter(Boolean).pop() ?? null)
    : null;

  const statusTone =
    uploadActivity?.phase === 'success'
      ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100'
      : uploadActivity?.phase === 'error'
        ? 'border-rose-400/25 bg-rose-500/10 text-rose-100'
        : uploadActivity?.phase === 'paused'
          ? 'border-amber-400/25 bg-amber-500/10 text-amber-100'
          : 'border-blue-400/25 bg-blue-500/10 text-blue-100';

  return (
    <div className="flex h-full min-h-[600px] flex-col rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
      {/* 헤더 */}
      <div className="border-b border-gray-800 bg-gray-900/80 px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-white">
              {project.name}
            </h2>
            {project.description && (
              <p className="truncate text-xs text-gray-500">
                {project.description}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1 self-start rounded-lg border border-gray-800 bg-gray-950 p-0.5 sm:self-auto">
            <button
              onClick={() => setTab('browse')}
              disabled={isUploading}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === 'browse'
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-500 hover:text-gray-300'
              } ${isUploading ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              <Code2 size={13} />
              소스 보기
            </button>
            <button
              onClick={() => setTab('upload')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === 'upload'
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <Upload size={13} />
              업로드
            </button>
            <button
              onClick={() => setTab('versions')}
              disabled={isUploading}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === 'versions'
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-500 hover:text-gray-300'
              } ${isUploading ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              <History size={13} />
              버전
            </button>
          </div>
        </div>

        {uploadActivity && (
          <div
            className={`mt-3 rounded-xl border p-4 ${statusTone}`}
            data-testid="repository-upload-activity"
            aria-live="polite"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {uploadActivity.phase === 'success' ? (
                    <CheckCircle2 size={16} />
                  ) : uploadActivity.phase === 'error' ? (
                    <AlertTriangle size={16} />
                  ) : (
                    <Loader2
                      size={16}
                      className={isUploading ? 'animate-spin' : ''}
                    />
                  )}
                  <span>{uploadActivity.message}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs opacity-90">
                  <span>
                    {uploadActivity.phase === 'success'
                      ? '반영 완료'
                      : '서버 수신'}{' '}
                    {uploadActivity.uploadedCount}/
                    {uploadActivity.totalFiles}
                  </span>
                  <span>
                    배치 {uploadActivity.batchCurrent}/
                    {uploadActivity.batchTotal}
                  </span>
                  <span>{formatBytes(uploadActivity.totalBytes)}</span>
                  {uploadActivity.transportProgress !== null && (
                    <span>전송 {uploadActivity.transportProgress}%</span>
                  )}
                  {uploadActivity.sessionStatus && (
                    <span>세션 {uploadActivity.sessionStatus}</span>
                  )}
                  {uploadActivity.filteredCount > 0 && (
                    <span>제외 {uploadActivity.filteredCount}개</span>
                  )}
                </div>
                {uploadActivity.error && (
                  <p className="mt-2 text-xs text-rose-200">
                    {uploadActivity.error}
                  </p>
                )}
                {uploadActivity.failedFiles.length > 0 && (
                  <p className="mt-2 text-xs text-amber-100/90">
                    실패 파일:{' '}
                    {uploadActivity.failedFiles.slice(0, 5).join(', ')}
                    {uploadActivity.failedFiles.length > 5 && (
                      <span> 외 {uploadActivity.failedFiles.length - 5}개</span>
                    )}
                  </p>
                )}
                {uploadActivity.resumable &&
                  uploadActivity.phase === 'paused' && (
                    <p className="mt-2 text-xs text-amber-100/80">
                      업로드 탭에서 같은 폴더를 다시 선택하면 실패/미완료 배치만
                      이어서 업로드할 수 있습니다.
                    </p>
                  )}
              </div>

              <div className="flex items-center gap-2">
                {uploadActivity.phase === 'success' && (
                  <button
                    onClick={() => setTab('browse')}
                    className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-black/30"
                  >
                    소스 보기
                  </button>
                )}
                <button
                  onClick={() => setUploadActivity(null)}
                  disabled={isUploading}
                  className="rounded-lg border border-white/10 bg-black/20 p-1.5 text-white/80 transition hover:bg-black/30 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="업로드 상태 닫기"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/20">
              <div
                className="h-full rounded-full bg-current transition-all duration-300"
                style={{ width: `${Math.max(uploadActivity.progress, 4)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 본문 */}
      {tab === 'browse' ? (
        <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
          {/* 모바일 전환 바 — 파일 선택 후 어느 뷰를 볼지 전환 */}
          <div className="flex items-center justify-between gap-2 border-b border-gray-800 bg-gray-900/50 px-3 py-2 lg:hidden">
            <div className="flex gap-1 rounded-lg border border-gray-800 bg-gray-950 p-0.5">
              <button
                onClick={() => setMobileTreeOpen(true)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  mobileTreeOpen
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <FolderTree size={13} />
                파일 트리
              </button>
              <button
                onClick={() => setMobileTreeOpen(false)}
                disabled={!selectedPath}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  !mobileTreeOpen
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-500 hover:text-gray-300'
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                <FileCode2 size={13} />
                소스 보기
              </button>
            </div>
            {selectedFileName && (
              <span
                className="truncate text-xs text-gray-400"
                title={selectedPath ?? ''}
              >
                {selectedFileName}
              </span>
            )}
          </div>

          {/* 좌측 트리 — 데스크톱 고정 폭, 모바일 토글 전체 폭 */}
          <div
            className={`${mobileTreeOpen ? 'flex' : 'hidden'} lg:flex w-full lg:w-72 shrink-0 flex-col overflow-y-auto border-b border-gray-800 bg-gray-900/30 lg:border-b-0 lg:border-r`}
          >
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={20} className="animate-spin text-gray-600" />
              </div>
            ) : (
              <FileTreeView
                tree={tree}
                selectedPath={selectedPath}
                onSelect={handleSelectFile}
              />
            )}
          </div>
          {/* 우측 코드 뷰어 — 모바일은 트리가 닫혔을 때만 노출 */}
          <div
            className={`${mobileTreeOpen ? 'hidden' : 'flex'} lg:flex flex-1 min-w-0 flex-col overflow-hidden`}
          >
            <CodeViewer projectId={project.id} selectedPath={selectedPath} />
          </div>
        </div>
      ) : tab === 'upload' ? (
        <div className="flex-1 overflow-auto p-5">
          <UploadDropzone
            project={project}
            onUploadActivityChange={setUploadActivity}
            onUploaded={() => {
              onUploaded();
              reload();
              setTab('browse');
            }}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-5">
          <VersionList
            projectId={project.id}
            onRestored={() => {
              reload();
              setTab('browse');
            }}
          />
        </div>
      )}
    </div>
  );
}
