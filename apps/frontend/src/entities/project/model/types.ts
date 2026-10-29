export interface RepositoryProject {
  id: string;
  name: string;
  description: string | null;
  fileCount: number;
  totalSize: number;
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: FileTreeNode[];
}

export interface UploadResult {
  project: RepositoryProject;
  uploadedCount: number;
  totalBytes: number;
}

export interface RepositoryUploadActivity {
  projectId: string;
  projectName: string;
  phase: 'preparing' | 'uploading' | 'paused' | 'success' | 'error';
  progress: number;
  uploadedCount: number;
  totalFiles: number;
  totalBytes: number;
  filteredCount: number;
  batchCurrent: number;
  batchTotal: number;
  message: string;
  error: string | null;
  sessionId: string | null;
  sessionStatus: RepositoryUploadSessionStatus | null;
  failedFiles: string[];
  transportProgress: number | null;
  resumable: boolean;
}

export type RepositoryUploadSessionStatus =
  | 'pending'
  | 'uploading'
  | 'partial_failed'
  | 'finalizing'
  | 'finalization_failed'
  | 'superseded'
  | 'completed';

export type RepositoryUploadBatchStatus =
  'pending' | 'uploading' | 'failed' | 'completed';

export interface RepositoryUploadBatchFileMeta {
  relativePath: string;
  size: number;
  sha256: string;
}

export interface RepositoryUploadSessionBatch {
  index: number;
  totalFiles: number;
  totalBytes: number;
  status: RepositoryUploadBatchStatus;
  files?: RepositoryUploadBatchFileMeta[];
  uploadedCount: number;
  uploadedBytes: number;
  failedFiles: string[];
  error: string | null;
  updatedAt: string | null;
}

export interface RepositoryUploadSession {
  id: string;
  protocolVersion: number;
  projectId: string;
  projectName: string;
  status: RepositoryUploadSessionStatus;
  manifestDigest: string;
  replace: boolean;
  replaceApplied: boolean;
  totalFiles: number;
  totalBytes: number;
  filteredCount: number;
  batchTotal: number;
  uploadedCount: number;
  uploadedBytes: number;
  failedCount: number;
  failedFiles: string[];
  batches: RepositoryUploadSessionBatch[];
  currentBatchIndex: number | null;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  completedAt: string | null;
  publishedAt: string | null;
  snapshotId: string | null;
  finalizationError: string | null;
}

export interface CreateUploadSessionInput {
  protocolVersion: number;
  replace: boolean;
  totalFiles: number;
  totalBytes: number;
  filteredCount: number;
  manifestDigest: string;
  batches: Array<{
    index: number;
    totalFiles: number;
    totalBytes: number;
    files: RepositoryUploadBatchFileMeta[];
  }>;
}

export interface UploadSessionBatchResult {
  project: RepositoryProject;
  session: RepositoryUploadSession;
  batchIndex: number;
  uploadedCount: number;
  failedFiles: string[];
}

/** 큰 파일 조각 업로드 응답 — 서버가 받은 위치와 파일이 끝났는지 */
export interface UploadSessionContentResult extends UploadSessionBatchResult {
  receivedBytes: number;
  completed: boolean;
}

export interface FinalizeUploadSessionResult {
  project: RepositoryProject;
  session: RepositoryUploadSession;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
}

export interface ClientFile {
  /** 폴더 루트로부터의 상대 경로 (예: src/index.ts) */
  relativePath: string;
  file: File;
}

export interface FileContentResult {
  path: string;
  size: number;
  encoding: 'utf8' | 'base64';
  content: string;
  truncated: boolean;
}

export interface VersionedFileContentResult extends FileContentResult {
  found: boolean;
}

export interface ProjectVersion {
  id: string;
  createdAt: string;
  compressedSize: number;
  filename: string;
}
/** 업로드 정책은 서버가 정한다 (GET /repository/upload-limits). 화면은 받은 값을 그대로 쓴다. */
export interface RepositoryUploadLimits {
  maxFiles: number;
  maxTotalBytes: number;
  maxFileBytes?: number;
  maxBatches: number;
  /** 작은 파일을 한 요청으로 묶을 때의 파일 수·크기 */
  maxBatchFiles?: number;
  batchBytes?: number;
  /** 이보다 큰 파일은 혼자 한 배치로 이 크기씩 조각 업로드한다 */
  chunkBytes?: number;
}
