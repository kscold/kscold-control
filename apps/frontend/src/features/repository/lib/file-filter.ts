/** 업로드에서 제외할 디렉토리/파일 패턴 — src 코드만 올리기 위한 필터 */

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
  'env',
  '.env.local',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.turbo',
  '.cache',
  'target',
  '.gradle',
  '.idea',
  '.vscode',
  '.vs',
  '.DS_Store',
  '.serena',
  'coverage',
  '.nyc_output',
  'tmp',
  'temp',
  '.parcel-cache',
  '.expo',
  '.docusaurus',
  '__snapshots__',
]);

const EXCLUDED_FILE_PATTERNS = [
  /\.pyc$/,
  /\.pyo$/,
  /\.class$/,
  /\.log$/,
  /\.tmp$/,
  /\.swp$/,
  /\.swo$/,
  /\.DS_Store$/,
  /^Thumbs\.db$/,
  /\.lock$/,    // package-lock 등 — 필요하면 화이트리스트로 풀 것
];

const EXCLUDED_EXACT_FILENAMES = new Set([
  '.DS_Store',
  'Thumbs.db',
  'desktop.ini',
]);

export interface FilterStats {
  kept: number;
  filtered: number;
  filteredDirs: Set<string>;
  totalSize: number;
}

export function shouldExcludePath(relativePath: string): boolean {
  const parts = relativePath.split('/');
  for (const part of parts.slice(0, -1)) {
    if (EXCLUDED_DIRS.has(part)) return true;
  }
  const fileName = parts[parts.length - 1];
  if (EXCLUDED_EXACT_FILENAMES.has(fileName)) return true;
  if (EXCLUDED_DIRS.has(fileName)) return true;
  for (const pattern of EXCLUDED_FILE_PATTERNS) {
    if (pattern.test(fileName)) return true;
  }
  return false;
}

export function filterFiles<T extends { relativePath: string; file: { size: number } }>(
  files: T[],
): { kept: T[]; stats: FilterStats } {
  const kept: T[] = [];
  const filteredDirs = new Set<string>();
  let totalSize = 0;
  let filtered = 0;

  for (const f of files) {
    if (shouldExcludePath(f.relativePath)) {
      filtered++;
      const firstSegment = f.relativePath.split('/')[0];
      if (EXCLUDED_DIRS.has(firstSegment)) filteredDirs.add(firstSegment);
      continue;
    }
    kept.push(f);
    totalSize += f.file.size;
  }

  return { kept, stats: { kept: kept.length, filtered, filteredDirs, totalSize } };
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
