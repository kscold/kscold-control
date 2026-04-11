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

export interface IFileStorage {
  /** 프로젝트 디렉토리 생성 */
  ensureProject(projectName: string): Promise<void>;

  /** 단일 파일 쓰기 (상대경로 보존) */
  writeFile(projectName: string, relativePath: string, buffer: Buffer): Promise<void>;

  /** 프로젝트 전체 삭제 */
  removeProject(projectName: string): Promise<void>;

  /** 파일 트리 조회 */
  listTree(projectName: string): Promise<FileTreeNode>;

  /** 단일 파일 읽기 */
  readFile(projectName: string, relativePath: string): Promise<Buffer>;

  /** 프로젝트를 tar.gz 스트림으로 압축 */
  archiveProject(projectName: string): Promise<Readable>;

  /** 프로젝트 통계 (파일 수 + 총 바이트) */
  getStats(projectName: string): Promise<ProjectStats>;
}
