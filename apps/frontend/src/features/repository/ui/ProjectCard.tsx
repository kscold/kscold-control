import { FolderGit2, Trash2, Download, FileText } from 'lucide-react';
import { repositoryService } from '@/entities/project';
import { formatBytes } from '../lib/file-filter';
import type { RepositoryProject } from '@/entities/project';

interface ProjectCardProps {
  project: RepositoryProject;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

export function ProjectCard({
  project,
  isActive,
  onSelect,
  onDelete,
}: ProjectCardProps) {
  return (
    <div
      onClick={onSelect}
      className={`cursor-pointer rounded-xl border p-4 transition-all ${
        isActive
          ? 'border-blue-500 bg-blue-950/20'
          : 'border-gray-800 bg-gray-900/70 hover:border-gray-700'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <FolderGit2
            size={18}
            className={isActive ? 'text-blue-400' : 'text-gray-500'}
          />
          <h3 className="truncate text-sm font-semibold text-white">
            {project.name}
          </h3>
        </div>
        <div className="flex gap-1 ml-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              repositoryService.downloadArchive(project.id);
            }}
            className="rounded p-1 text-gray-500 hover:bg-gray-800 hover:text-white"
            title="다운로드"
          >
            <Download size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`"${project.name}" 프로젝트를 삭제할까요?`)) {
                onDelete();
              }
            }}
            className="rounded p-1 text-gray-500 hover:bg-red-950 hover:text-red-400"
            title="삭제"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {project.description && (
        <p className="mt-2 text-xs text-gray-500 line-clamp-2">
          {project.description}
        </p>
      )}

      <div className="mt-3 flex items-center gap-3 text-[11px] text-gray-500">
        <span className="flex items-center gap-1">
          <FileText size={11} />
          {project.fileCount.toLocaleString()}
        </span>
        <span>{formatBytes(Number(project.totalSize))}</span>
        <span className="ml-auto">
          {new Date(project.updatedAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}
