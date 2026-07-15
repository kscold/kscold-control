export type RepositoryUploadSessionStatus =
  'pending' | 'uploading' | 'partial_failed' | 'completed';

export type RepositoryUploadBatchStatus =
  'pending' | 'uploading' | 'failed' | 'completed';

export interface RepositoryUploadBatchFile {
  relativePath: string;
  size: number;
}

export interface RepositoryUploadBatch {
  index: number;
  totalFiles: number;
  totalBytes: number;
  status: RepositoryUploadBatchStatus;
  files: RepositoryUploadBatchFile[];
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
  batches: RepositoryUploadBatch[];
  currentBatchIndex: number | null;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  completedAt: string | null;
}
