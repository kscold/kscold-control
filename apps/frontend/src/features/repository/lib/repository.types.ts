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

export interface CreateProjectInput {
  name: string;
  description?: string;
}

export interface ClientFile {
  /** 폴더 루트로부터의 상대 경로 (예: src/index.ts) */
  relativePath: string;
  file: File;
}
