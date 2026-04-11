import { useMemo } from 'react';
import { Copy, FileText, Loader2, AlertCircle } from 'lucide-react';
import { useFileContent } from '../hooks/useProjectTree';

interface CodeViewerProps {
  projectId: string;
  selectedPath: string | null;
}

export function CodeViewer({ projectId, selectedPath }: CodeViewerProps) {
  const { content, loading, error } = useFileContent(projectId, selectedPath);

  const language = useMemo(() => detectLanguage(selectedPath), [selectedPath]);

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

  if (content.encoding === 'base64') {
    return (
      <div className="flex h-full items-center justify-center text-center">
        <div>
          <FileText size={48} className="mx-auto text-gray-700" />
          <p className="mt-3 text-sm text-gray-500">바이너리 파일은 미리볼 수 없습니다</p>
          <p className="mt-1 text-xs text-gray-600">{formatBytes(content.size)}</p>
        </div>
      </div>
    );
  }

  const lines = content.content.split('\n');

  return (
    <div className="flex h-full flex-col">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-gray-800 bg-gray-900/60 px-4 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileText size={14} className="shrink-0 text-gray-500" />
          <span className="truncate font-mono text-xs text-gray-300">{selectedPath}</span>
          {language && (
            <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] uppercase text-gray-500">
              {language}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[10px] text-gray-500 shrink-0">
          <span>
            {lines.length}줄 · {formatBytes(content.size)}
          </span>
          {content.truncated && (
            <span className="rounded bg-amber-900/40 px-2 py-0.5 text-amber-400">
              잘림 (512KB 미리보기)
            </span>
          )}
          <button
            onClick={() => navigator.clipboard.writeText(content.content)}
            className="rounded p-1 hover:bg-gray-800 hover:text-white"
            title="복사"
          >
            <Copy size={12} />
          </button>
        </div>
      </div>

      {/* 코드 본문 */}
      <div className="flex-1 overflow-auto bg-gray-950">
        <div className="flex font-mono text-xs leading-5">
          {/* 줄 번호 */}
          <div className="select-none border-r border-gray-800 bg-gray-900/40 px-3 py-3 text-right text-gray-600">
            {lines.map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
          {/* 코드 */}
          <pre className="flex-1 overflow-x-auto px-4 py-3 text-gray-300">
            <code>{content.content}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}

function detectLanguage(path: string | null): string | null {
  if (!path) return null;
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
    py: 'python', java: 'java', kt: 'kotlin', go: 'go', rs: 'rust',
    rb: 'ruby', php: 'php', swift: 'swift', c: 'c', cpp: 'cpp', h: 'c',
    cs: 'csharp', sh: 'bash', sql: 'sql', vue: 'vue', svelte: 'svelte',
    html: 'html', css: 'css', scss: 'scss', json: 'json',
    yml: 'yaml', yaml: 'yaml', toml: 'toml', xml: 'xml', md: 'markdown',
    proto: 'protobuf', graphql: 'graphql',
  };
  return map[ext] ?? ext ?? null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}
