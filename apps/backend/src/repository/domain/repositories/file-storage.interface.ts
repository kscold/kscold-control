import { Readable } from 'stream';

export const FILE_STORAGE = Symbol('FILE_STORAGE');

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: FileTreeNode[];
}

export interface ProjectStats {
  fileCount: number;
  totalSize: number;
}

export interface ProjectVersion {
  id: string; // 파일명(타임스탬프) 기반 ID
  createdAt: Date;
  compressedSize: number; // tar.gz 파일 크기 (bytes)
  filename: string;
}

export interface IFileStorage {
  /** 프로젝트 디렉토리 생성 */
  ensureProject(projectName: string): Promise<void>;

  /** 단일 파일 쓰기 (상대경로 보존) */
  writeFile(
    projectName: string,
    relativePath: string,
    buffer: Buffer,
  ): Promise<void>;

  /** 프로젝트 전체 삭제 (.versions 히스토리 포함) */
  removeProject(projectName: string): Promise<void>;

  /** 프로젝트 콘텐츠만 비우기 — .versions 버전 히스토리는 보존 (replace 업로드용) */
  clearProjectFiles(projectName: string): Promise<void>;

  /** 파일 트리 조회 */
  listTree(projectName: string): Promise<FileTreeNode>;

  /** 단일 파일 읽기 */
  readFile(projectName: string, relativePath: string): Promise<Buffer>;

  /** 특정 버전 아카이브에서 단일 파일 읽기 */
  readFileAtVersion(
    projectName: string,
    versionId: string,
    relativePath: string,
  ): Promise<Buffer | null>;

  /** 프로젝트를 tar.gz 스트림으로 압축 */
  archiveProject(projectName: string): Promise<Readable>;

  /** 프로젝트 통계 (파일 수 + 총 바이트) */
  getStats(projectName: string): Promise<ProjectStats>;

  /** 현재 파일 상태를 .versions/ 에 tar.gz 스냅샷으로 저장 */
  createSnapshot(projectName: string): Promise<ProjectVersion>;

  /** 버전 목록 조회 (최신순) */
  listVersions(projectName: string): Promise<ProjectVersion[]>;

  /** 오래된 버전 삭제 — keepCount 이외 전부 삭제 (기본 1개 유지) */
  cleanupVersions(projectName: string, keepCount?: number): Promise<number>;

  /** 특정 버전 복원 (해당 tar.gz로 파일 교체) */
  restoreVersion(projectName: string, versionId: string): Promise<void>;
}
