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
  | 'completed';

export type RepositoryUploadBatchStatus =
  | 'pending'
  | 'uploading'
  | 'failed'
  | 'completed';

export interface RepositoryUploadBatchFileMeta {
  relativePath: string;
  size: number;
}

export interface RepositoryUploadSessionBatch {
  index: number;
  totalFiles: number;
  totalBytes: number;
  status: RepositoryUploadBatchStatus;
  files: RepositoryUploadBatchFileMeta[];
  uploadedCount: number;
  uploadedBytes: number;
  failedFiles: string[];
  error: string | null;
  updatedAt: string | null;
}

export interface RepositoryUploadSession {
  id: string;
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
}

export interface CreateUploadSessionInput {
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
