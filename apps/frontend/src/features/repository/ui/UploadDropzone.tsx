import { useRef, useState } from 'react';
import { Upload, FolderUp, Loader2 } from 'lucide-react';
import { repositoryService } from '../../../services/api/repository.service';
import {
  filterFiles,
  formatBytes,
  chunkFiles,
  type FilterStats,
} from '../lib/file-filter';
import type { ClientFile, RepositoryProject } from '../lib/repository.types';

interface UploadDropzoneProps {
  project: RepositoryProject;
  onUploaded: () => void;
}

export function UploadDropzone({ project, onUploaded }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastStats, setLastStats] = useState<FilterStats | null>(null);

  const [batchInfo, setBatchInfo] = useState<{ current: number; total: number } | null>(null);

  const handleFiles = async (fileList: FileList) => {
    const allFiles: ClientFile[] = Array.from(fileList).map((f) => ({
      relativePath: stripTopFolder(
        (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name,
      ),
      file: f,
    }));

    const { kept, stats } = filterFiles(allFiles);
    setLastStats(stats);

    if (kept.length === 0) {
      setError('업로드할 파일이 없습니다 (전부 필터링됨)');
      return;
    }

    const batches = chunkFiles(kept, 50, 8 * 1024 * 1024);

    if (
      !confirm(
        `${kept.length}개 파일 (${formatBytes(stats.totalSize)}) 업로드할까요?\n` +
          `${batches.length}개 배치로 나눠서 전송됩니다\n` +
          (stats.filtered > 0
            ? `필터 제외: ${stats.filtered}개 (디렉토리 ${stats.filteredByDir}, 확장자 ${stats.filteredByExt}, 크기초과 ${stats.filteredBySize})`
            : ''),
      )
    ) {
      return;
    }

    setUploading(true);
    setProgress(0);
    setBatchInfo({ current: 0, total: batches.length });
    setError(null);
    try {
      for (let i = 0; i < batches.length; i++) {
        setBatchInfo({ current: i + 1, total: batches.length });
        await repositoryService.uploadFiles(project.id, batches[i], {
          // 첫 배치는 기존 내용 교체, 이후 배치는 이어붙임
          replace: i === 0,
          onProgress: (p) => {
            const overall = Math.floor(((i + p / 100) / batches.length) * 100);
            setProgress(overall);
          },
        });
      }
      onUploaded();
    } catch (e) {
      setError(e instanceof Error ? e.message : '업로드 실패');
    } finally {
      setUploading(false);
      setProgress(0);
      setBatchInfo(null);
    }
  };

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
          await collectFromDataTransfer(e.dataTransfer, handleFiles);
        }}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all ${
          dragOver ? 'border-blue-500 bg-blue-950/20' : 'border-gray-700 hover:border-gray-600'
        } ${uploading ? 'pointer-events-none opacity-50' : ''}`}
      >
        {uploading ? (
          <>
            <Loader2 size={40} className="mx-auto animate-spin text-blue-400" />
            <p className="mt-4 text-sm text-white">
              업로드 중... {progress}%
              {batchInfo && (
                <span className="ml-2 text-xs text-gray-400">
                  (배치 {batchInfo.current}/{batchInfo.total})
                </span>
              )}
            </p>
            <div className="mt-3 mx-auto h-1.5 max-w-xs rounded-full bg-gray-800">
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
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
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {lastStats && (
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3 text-xs text-gray-400">
          마지막 업로드 시도 — 보존: {lastStats.kept}개 · 제외: {lastStats.filtered}개 ·
          크기: {formatBytes(lastStats.totalSize)}
          {lastStats.filteredDirs.size > 0 && (
            <div className="mt-1 text-gray-600">
              제외된 폴더: {Array.from(lastStats.filteredDirs).join(', ')}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      <button
        onClick={() => {
          window.location.href = repositoryService.getDownloadUrl(project.id);
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

/** 드래그앤드롭으로 떨어진 폴더를 재귀적으로 풀어 FileList 형태로 변환 */
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

  for (let i = 0; i < items.length; i++) {
    const entry = (items[i] as DataTransferItem & {
      webkitGetAsEntry?: () => FileSystemEntry | null;
    }).webkitGetAsEntry?.();
    if (entry) tasks.push(walkEntry(entry, '', allFiles));
  }
  await Promise.all(tasks);

  // FileList처럼 사용하기 위해 DataTransfer 재구성
  const dt2 = new DataTransfer();
  allFiles.forEach((f) => dt2.items.add(f));
  await handler(dt2.files);
}

function walkEntry(entry: FileSystemEntry, parentPath: string, out: File[]): Promise<void> {
  return new Promise((resolve) => {
    if (entry.isFile) {
      (entry as FileSystemFileEntry).file((f) => {
        Object.defineProperty(f, 'webkitRelativePath', {
          value: parentPath ? `${parentPath}/${f.name}` : f.name,
        });
        out.push(f);
        resolve();
      });
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      const all: FileSystemEntry[] = [];
      const readBatch = () => {
        reader.readEntries(async (entries) => {
          if (entries.length === 0) {
            await Promise.all(
              all.map((e) =>
                walkEntry(e, parentPath ? `${parentPath}/${entry.name}` : entry.name, out),
              ),
            );
            resolve();
          } else {
            all.push(...entries);
            readBatch();
          }
        });
      };
      readBatch();
    } else {
      resolve();
    }
  });
}
