/** 원본과 설정은 보존하고 재생성 가능한 캐시/산출물과 VCS 메타데이터만 제외한다. */

const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  '.ruff_cache',
  '.tox',
  'venv',
  '.venv',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.turbo',
  '.cache',
  'target',
  '.gradle',
  '.vs',
  '.metadata', // Eclipse
  'coverage',
  '.nyc_output',
  '.parcel-cache',
  '.expo',
  '.docusaurus',
  '.pnpm-store',
]);

const CACHE_FILE_PATTERN = /\.(?:pyc|pyo|tsbuildinfo)$/i;

const EXCLUDED_EXACT_FILENAMES = new Set([
  '.ds_store',
  'thumbs.db',
  'desktop.ini',
  '.git', // git worktree의 메타데이터 포인터도 원본 파일이 아니다.
]);

export interface FilterStats {
  kept: number;
  filtered: number;
  filteredDirs: Set<string>;
  filteredByExt: number;
  filteredByDir: number;
  /** 선택 뒤 바뀌거나 사라져 읽지 못하고 건너뛴 파일 경로 */
  unreadablePaths?: string[];
  totalSize: number;
}

export type ExcludeReason = 'dir' | 'ext' | 'name' | null;

export function getExcludeReason(relativePath: string): ExcludeReason {
  const parts = relativePath.replace(/\\/g, '/').split('/');
  // 디렉토리 필터
  for (const part of parts.slice(0, -1)) {
    if (EXCLUDED_DIRS.has(part)) return 'dir';
  }
  const fileName = parts[parts.length - 1];
  // 정확 매칭 파일명
  if (EXCLUDED_EXACT_FILENAMES.has(fileName.toLowerCase())) {
    return 'name';
  }
  if (CACHE_FILE_PATTERN.test(fileName)) return 'ext';
  return null;
}

export function filterFiles<
  T extends { relativePath: string; file: { size: number } },
>(files: T[]): { kept: T[]; stats: FilterStats } {
  const kept: T[] = [];
  const filteredDirs = new Set<string>();
  let totalSize = 0;
  let filteredByDir = 0;
  let filteredByExt = 0;
  let filtered = 0;

  for (const f of files) {
    const reason = getExcludeReason(f.relativePath);
    if (reason !== null) {
      filtered++;
      if (reason === 'dir') {
        filteredByDir++;
        const excludedDirectory = f.relativePath
          .replace(/\\/g, '/')
          .split('/')
          .slice(0, -1)
          .find((segment) => EXCLUDED_DIRS.has(segment));
        if (excludedDirectory) filteredDirs.add(excludedDirectory);
      } else if (reason === 'ext') {
        filteredByExt++;
      }
      continue;
    }
    kept.push(f);
    totalSize += f.file.size;
  }

  return {
    kept,
    stats: {
      kept: kept.length,
      filtered,
      filteredDirs,
      filteredByExt,
      filteredByDir,
      totalSize,
    },
  };
}

/** 청크 업로드용 — 파일 배열을 N개씩 또는 M바이트 이내 배치로 자름 */
export function chunkFiles<T extends { file: { size: number } }>(
  files: T[],
  maxBatchFiles = 50,
  maxBatchBytes = 8 * 1024 * 1024,
): T[][] {
  const batches: T[][] = [];
  let cur: T[] = [];
  let curBytes = 0;
  for (const f of files) {
    if (
      cur.length >= maxBatchFiles ||
      (cur.length > 0 && curBytes + f.file.size > maxBatchBytes)
    ) {
      batches.push(cur);
      cur = [];
      curBytes = 0;
    }
    cur.push(f);
    curBytes += f.file.size;
  }
  if (cur.length > 0) batches.push(cur);
  return batches;
}
