/** 업로드에서 제외할 디렉토리/파일 패턴 — src 코드만 올리기 위한 필터 */

/** 단일 파일 최대 크기 — 이보다 크면 자동 제외 (코드/설정 파일은 거의 1MB 이하) */
export const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024;

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
  'bin',
  '.gradle',
  '.idea',
  '.vscode',
  '.vs',
  '.metadata', // Eclipse
  '.settings', // Eclipse
  '.classpath',
  '.project',
  '.DS_Store',
  '.serena',
  '.claude',
  '.ssh',
  '.aws',
  '.gnupg',
  '.kube',
  '.docker',
  '.azure',
  '.terraform',
  '.pulumi',
  'coverage',
  '.nyc_output',
  'tmp',
  'temp',
  '.parcel-cache',
  '.expo',
  '.docusaurus',
  '__snapshots__',
  'logs',
  'log',
]);

const EXCLUDED_EXTENSIONS = new Set([
  // 빌드 산출물
  'pyc',
  'pyo',
  'class',
  'jar',
  'war',
  'ear',
  'dll',
  'exe',
  'so',
  'dylib',
  'a',
  'lib',
  'o',
  'obj',
  // 이미지/미디어 (코드 저장소면 일반적으로 큼)
  'png',
  'jpg',
  'jpeg',
  'gif',
  'bmp',
  'tiff',
  'tif',
  'ico',
  'webp',
  'psd',
  'ai',
  'eps',
  'mp3',
  'mp4',
  'avi',
  'mov',
  'mkv',
  'wmv',
  'flv',
  'webm',
  'wav',
  'flac',
  'ogg',
  'm4a',
  // 폰트
  'ttf',
  'otf',
  'woff',
  'woff2',
  'eot',
  // 문서/오피스
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'odt',
  'ods',
  'odp',
  'rtf',
  // 압축
  'zip',
  'tar',
  'gz',
  'bz2',
  '7z',
  'rar',
  'iso',
  'dmg',
  'pkg',
  // 데이터 (대용량 가능)
  'sqlite',
  'db',
  'mdb',
  'bak',
  // ML/바이너리 데이터
  'bin',
  'pkl',
  'pickle',
  'npy',
  'npz',
  'h5',
  'hdf5',
  'feather',
  'parquet',
  'safetensors',
  'ckpt',
  'pt',
  'pth',
  'onnx',
  'pb',
  'tflite',
  // 대용량 데이터/지도 (보통 빌드 산출물 또는 외부 데이터)
  'geojson',
  'shp',
  'shx',
  'dbf',
  // 임시
  'log',
  'tmp',
  'swp',
  'swo',
  'lock',
]);

/** minified 산출물 패턴 — 확장자 검사로 못 잡는 패턴 */
const MINIFIED_PATTERNS = [
  /\.min\.js$/,
  /\.min\.css$/,
  /\.bundle\.js$/,
  /\.chunk\.[a-f0-9]{6,}\.js$/,
  /\bvendor\.[a-f0-9]+\.js$/,
];

const EXCLUDED_EXACT_FILENAMES = new Set([
  '.DS_Store',
  'Thumbs.db',
  'desktop.ini',
  '.env',
  '.envrc',
  '.git-credentials',
  '.npmrc',
  '.pypirc',
  '.netrc',
  '.vault-token',
  'auth.json',
  'credentials.json',
  'secrets.json',
  'id_rsa',
  'id_ed25519',
  'id_ecdsa',
  'id_dsa',
  'kubeconfig',
]);

const SENSITIVE_FILE_PATTERNS = [
  /^\.env\.(?!(?:example|sample|template)$).+/i,
  /(?:^|[-_.])service[-_]?account(?:[-_.]|$)/i,
  /(?:^|[-_.])client[-_]?secret(?:[-_.]|$)/i,
  /^terraform\.tfstate(?:\..+)?$/i,
  /\.(?:pem|key|p12|pfx)$/i,
];

export interface FilterStats {
  kept: number;
  filtered: number;
  filteredDirs: Set<string>;
  filteredByExt: number;
  filteredByDir: number;
  filteredBySize: number;
  totalSize: number;
}

export type ExcludeReason = 'dir' | 'ext' | 'size' | 'name' | null;

export function getExcludeReason(
  relativePath: string,
  size: number,
): ExcludeReason {
  const parts = relativePath.split('/');
  // 디렉토리 필터
  for (const part of parts.slice(0, -1)) {
    if (EXCLUDED_DIRS.has(part)) return 'dir';
  }
  const fileName = parts[parts.length - 1];
  // 정확 매칭 파일명
  if (
    EXCLUDED_EXACT_FILENAMES.has(fileName) ||
    EXCLUDED_EXACT_FILENAMES.has(fileName.toLowerCase())
  ) {
    return 'name';
  }
  if (SENSITIVE_FILE_PATTERNS.some((pattern) => pattern.test(fileName))) {
    return 'name';
  }
  if (EXCLUDED_DIRS.has(fileName)) return 'dir';
  // minified / 빌드 산출물 패턴
  for (const pattern of MINIFIED_PATTERNS) {
    if (pattern.test(fileName)) return 'ext';
  }
  // 확장자 필터
  const dotIdx = fileName.lastIndexOf('.');
  if (dotIdx > 0) {
    const ext = fileName.slice(dotIdx + 1).toLowerCase();
    if (EXCLUDED_EXTENSIONS.has(ext)) return 'ext';
  }
  // 크기 필터
  if (size > MAX_FILE_SIZE_BYTES) return 'size';
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
  let filteredBySize = 0;
  let filtered = 0;

  for (const f of files) {
    const reason = getExcludeReason(f.relativePath, f.file.size);
    if (reason !== null) {
      filtered++;
      if (reason === 'dir') {
        filteredByDir++;
        const firstSegment = f.relativePath.split('/')[0];
        if (EXCLUDED_DIRS.has(firstSegment)) filteredDirs.add(firstSegment);
      } else if (reason === 'ext') {
        filteredByExt++;
      } else if (reason === 'size') {
        filteredBySize++;
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
      filteredBySize,
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
