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

export interface RepositoryUploadBatchFile {
  relativePath: string;
  size: number;
  sha256: string;
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
  batches: RepositoryUploadBatch[];
  currentBatchIndex: number | null;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  completedAt: string | null;
  publishedAt: string | null;
  snapshotId: string | null;
  finalizationError: string | null;
}

export const REPOSITORY_UPLOAD_PROTOCOL_VERSION = 2;
