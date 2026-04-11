import { useState } from 'react';
import { Loader2, Upload, Code2 } from 'lucide-react';
import { useProjectTree } from '../hooks/useProjectTree';
import { FileTreeView } from './FileTreeView';
import { CodeViewer } from './CodeViewer';
import { UploadDropzone } from './UploadDropzone';
import type { RepositoryProject } from '../lib/repository.types';

interface ProjectBrowserProps {
  project: RepositoryProject;
  onUploaded: () => void;
}

type Tab = 'browse' | 'upload';

export function ProjectBrowser({ project, onUploaded }: ProjectBrowserProps) {
  const [tab, setTab] = useState<Tab>('browse');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const { tree, loading, reload } = useProjectTree(project.id);

  return (
    <div className="flex h-full min-h-[600px] flex-col rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-gray-800 bg-gray-900/80 px-5 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-white">{project.name}</h2>
          {project.description && (
            <p className="truncate text-xs text-gray-500">{project.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-gray-800 bg-gray-950 p-0.5">
          <button
            onClick={() => setTab('browse')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === 'browse'
                ? 'bg-gray-800 text-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Code2 size={13} />
            소스 보기
          </button>
          <button
            onClick={() => setTab('upload')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === 'upload'
                ? 'bg-gray-800 text-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Upload size={13} />
            업로드
          </button>
        </div>
      </div>

      {/* 본문 */}
      {tab === 'browse' ? (
        <div className="flex flex-1 min-h-0">
          {/* 좌측 트리 */}
          <div className="w-72 shrink-0 overflow-y-auto border-r border-gray-800 bg-gray-900/30">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={20} className="animate-spin text-gray-600" />
              </div>
            ) : (
              <FileTreeView
                tree={tree}
                selectedPath={selectedPath}
                onSelect={setSelectedPath}
              />
            )}
          </div>
          {/* 우측 코드 뷰어 */}
          <div className="flex-1 min-w-0 overflow-hidden">
            <CodeViewer projectId={project.id} selectedPath={selectedPath} />
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-5">
          <UploadDropzone
            project={project}
            onUploaded={() => {
              onUploaded();
              reload();
              setTab('browse');
            }}
          />
        </div>
      )}
    </div>
  );
}
