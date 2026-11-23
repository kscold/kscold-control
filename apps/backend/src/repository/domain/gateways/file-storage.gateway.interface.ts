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

export interface StagedUploadFile {
  relativePath: string;
  size: number;
  sha256: string;
}

export interface RepositoryFileInspection {
  files: StagedUploadFile[];
  stats: ProjectStats;
}

export interface StagedUploadInspection extends RepositoryFileInspection {
  source: 'staging' | 'published';
}

export interface FinalizedUpload {
  stats: ProjectStats;
  version: ProjectVersion;
  publishedAt: string;
}

export interface IFileStorage {
  /** 프로젝트 디렉토리 생성 */
  ensureProject(projectName: string): Promise<void>;

  /** 완성 전 파일을 라이브 프로젝트와 분리된 세션 디렉토리에 준비 */
  prepareStagedUpload(
    projectName: string,
    sessionId: string,
    replace: boolean,
  ): Promise<void>;

  /** 세션 스테이징 디렉토리에 단일 파일 기록 */
  writeStagedFile(
    projectName: string,
    sessionId: string,
    relativePath: string,
    buffer: Buffer,
  ): Promise<void>;

  /** 업로드 저장 위치의 디스크 여유 공간 (바이트) */
  getFreeBytes(): Promise<number>;

  /** 조각으로 받는 큰 파일의 지금까지 받은 크기 (없으면 0) */
  stagedContentSize(
    projectName: string,
    sessionId: string,
    batchIndex: number,
  ): Promise<number>;

  /**
   * 조각 하나를 offset 위치에 이어 쓴다. 지금 받은 크기가 offset 과 다르면 쓰지 않고
   * UploadContentOffsetError 를 던진다. maxBytes 를 넘으면 쓰던 조각을 되돌린다. 새 크기를 돌려준다.
   */
  appendStagedContent(
    projectName: string,
    sessionId: string,
    batchIndex: number,
    offset: number,
    source: Readable,
    maxBytes: number,
  ): Promise<number>;

  /** 다 받은 큰 파일의 해시를 확인하고 스테이징 경로로 옮긴다. 해시가 다르면 받은 내용을 지우고 false */
  commitStagedContent(
    projectName: string,
    sessionId: string,
    batchIndex: number,
    relativePath: string,
    sha256: string,
  ): Promise<boolean>;

  /** 최종 반영 전 스테이징 파일 전체를 다시 해시해 무결성 확인 */
  inspectStagedUpload(
    projectName: string,
    sessionId: string,
  ): Promise<StagedUploadInspection>;

  /** 검증된 스테이징을 새 버전으로 남긴 뒤 라이브 디렉토리로 전환 */
  finalizeStagedUpload(
    projectName: string,
    sessionId: string,
  ): Promise<FinalizedUpload>;

  /** 폐기된 세션의 스테이징 데이터 정리 */
  discardStagedUpload(projectName: string, sessionId: string): Promise<void>;

  /** 프로젝트 라이브 파일과 별도 버전·업로드 작업 디렉터리 전체 삭제 */
  removeProject(projectName: string): Promise<void>;

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

  /** 현재 파일 상태를 별도 버전 저장소에 tar.gz 스냅샷으로 저장 */
  createSnapshot(projectName: string): Promise<ProjectVersion>;

  /** 버전 목록 조회 (최신순) */
  listVersions(projectName: string): Promise<ProjectVersion[]>;

  /** 오래된 버전 삭제 — keepCount 이외 전부 삭제 (기본 1개 유지) */
  cleanupVersions(projectName: string, keepCount?: number): Promise<number>;

  /** 특정 버전 복원 (해당 tar.gz로 파일 교체) */
  restoreVersion(projectName: string, versionId: string): Promise<void>;
}

/** 조각 업로드 offset 이 서버가 받은 크기와 다를 때 (클라이언트는 receivedBytes 부터 이어서 보냄) */
export class UploadContentOffsetError extends Error {
  constructor(readonly receivedBytes: number) {
    super(`업로드 위치가 맞지 않습니다. 서버가 받은 크기: ${receivedBytes}`);
  }
}

/** 조각 하나가 허용 크기를 넘었을 때 */
export class UploadContentTooLargeError extends Error {
  constructor(readonly maxBytes: number) {
    super(`업로드 조각이 허용 크기 ${maxBytes} 바이트를 넘었습니다.`);
  }
}
