import { useMemo, useState } from 'react';
import {
  Copy,
  FileText,
  Loader2,
  AlertCircle,
  GitCompare,
} from 'lucide-react';
import hljs from 'highlight.js/lib/common';
import 'highlight.js/styles/github-dark.css';
import {
  useFileContent,
  useFileAtVersion,
  useLatestVersion,
} from '../hooks/useProjectTree';
import { DiffViewer } from './DiffViewer';

interface CodeViewerProps {
  projectId: string;
  selectedPath: string | null;
}

export function CodeViewer({ projectId, selectedPath }: CodeViewerProps) {
  const [diffMode, setDiffMode] = useState(false);
  const { content, loading, error } = useFileContent(projectId, selectedPath);
  const { latestId: latestVersionId, count: versionCount } =
    useLatestVersion(projectId);
  const {
    content: previousContent,
    loading: previousLoading,
    error: previousError,
  } = useFileAtVersion(
    projectId,
    selectedPath,
    latestVersionId,
    diffMode && !!latestVersionId,
  );

  const language = useMemo(() => detectLanguage(selectedPath), [selectedPath]);

  const highlighted = useMemo(() => {
    if (!content || content.encoding === 'base64') return null;
    return renderHighlighted(content.content, language);
  }, [content, language]);

  if (!selectedPath) {
    return (
      <div className="flex h-full items-center justify-center text-center">
        <div>
          <FileText size={48} className="mx-auto text-gray-700" />
          <p className="mt-3 text-sm text-gray-500">왼쪽 트리에서 파일을 선택하세요</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={24} className="animate-spin text-gray-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-center">
        <div className="max-w-md">
          <AlertCircle size={32} className="mx-auto text-red-500" />
          <p className="mt-2 text-sm text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!content) return null;

  const isBinary = content.encoding === 'base64';
  const diffAvailable = !!latestVersionId && !isBinary;
  const lineCount = isBinary ? 0 : content.content.split('\n').length;

  return (
    <div className="flex h-full flex-col">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-2 border-b border-gray-800 bg-gray-900/60 px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <FileText size={14} className="shrink-0 text-gray-500" />
          <span className="truncate font-mono text-xs text-gray-300">{selectedPath}</span>
          {language && (
            <span className="shrink-0 rounded bg-gray-800 px-1.5 py-0.5 text-[10px] uppercase text-gray-500">
              {language}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 text-[10px] text-gray-500">
          {!diffMode && (
            <span className="hidden whitespace-nowrap sm:inline">
              {lineCount}줄 · {formatBytes(content.size)}
            </span>
          )}
          {content.truncated && !diffMode && (
            <span className="whitespace-nowrap rounded bg-amber-900/40 px-2 py-0.5 text-amber-400">
              잘림
            </span>
          )}
          <button
            onClick={() => setDiffMode((m) => !m)}
            disabled={!diffAvailable}
            title={
              !diffAvailable
                ? versionCount === 0
                  ? '아직 저장된 버전이 없습니다'
                  : '바이너리 파일은 diff를 지원하지 않습니다'
                : diffMode
                  ? '현재 내용 보기'
                  : '이전 버전과 비교'
            }
            className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition ${
              diffMode
                ? 'bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25'
                : diffAvailable
                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
                  : 'bg-gray-900 text-gray-600 cursor-not-allowed'
            }`}
          >
            <GitCompare size={12} />
            <span>diff</span>
          </button>
          {!diffMode && (
            <button
              onClick={() => navigator.clipboard.writeText(content.content)}
              className="rounded p-1 hover:bg-gray-800 hover:text-white"
              title="복사"
            >
              <Copy size={12} />
            </button>
          )}
        </div>
      </div>

      {/* 본문 */}
      {diffMode ? (
        previousLoading ? (
          <div className="flex flex-1 items-center justify-center bg-[#0d1117]">
            <Loader2 size={20} className="animate-spin text-gray-600" />
          </div>
        ) : previousError ? (
          <div className="flex flex-1 items-center justify-center bg-[#0d1117] text-sm text-red-400">
            {previousError}
          </div>
        ) : previousContent ? (
          <DiffViewer
            beforeText={previousContent.found ? previousContent.content : ''}
            afterText={isBinary ? '' : content.content}
            beforeMissing={!previousContent.found}
            afterMissing={false}
          />
        ) : null
      ) : isBinary ? (
        <div className="flex flex-1 items-center justify-center text-center">
          <div>
            <FileText size={48} className="mx-auto text-gray-700" />
            <p className="mt-3 text-sm text-gray-500">바이너리 파일은 미리볼 수 없습니다</p>
            <p className="mt-1 text-xs text-gray-600">{formatBytes(content.size)}</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto bg-[#0d1117]">
          <div className="flex font-mono text-xs leading-5">
            <div className="select-none border-r border-gray-800/80 bg-gray-900/40 px-3 py-3 text-right text-gray-600">
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
            <pre className="flex-1 overflow-x-auto py-3">
              <code
                className={`hljs block px-4 ${language ? `language-${language}` : ''}`}
                dangerouslySetInnerHTML={{ __html: highlighted ?? '' }}
              />
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

const LANGUAGE_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  py: 'python',
  java: 'java',
  kt: 'kotlin',
  kts: 'kotlin',
  go: 'go',
  rs: 'rust',
  rb: 'ruby',
  php: 'php',
  swift: 'swift',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  sql: 'sql',
  html: 'xml',
  htm: 'xml',
  xml: 'xml',
  css: 'css',
  scss: 'scss',
  less: 'less',
  json: 'json',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'ini',
  ini: 'ini',
  md: 'markdown',
  markdown: 'markdown',
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  r: 'r',
  lua: 'lua',
  pl: 'perl',
  diff: 'diff',
  patch: 'diff',
};

function detectLanguage(path: string | null): string | null {
  if (!path) return null;
  const file = path.split('/').filter(Boolean).pop() ?? '';
  const lower = file.toLowerCase();
  if (lower === 'dockerfile') return 'dockerfile';
  if (lower === 'makefile') return 'makefile';
  const ext = lower.includes('.') ? lower.split('.').pop() ?? '' : '';
  return LANGUAGE_MAP[ext] ?? null;
}

function renderHighlighted(code: string, language: string | null): string {
  if (language && hljs.getLanguage(language)) {
    try {
      return hljs.highlight(code, { language, ignoreIllegals: true }).value;
    } catch {
      // fall through to auto
    }
  }
  try {
    return hljs.highlightAuto(code).value;
  } catch {
    return escapeHtml(code);
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}
