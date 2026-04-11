import { useState } from 'react';
import { FolderGit2, Plus, Loader2 } from 'lucide-react';
import { useProjects } from '../hooks/useProjects';
import { ProjectCard } from './ProjectCard';
import { CreateProjectModal } from './CreateProjectModal';
import { UploadDropzone } from './UploadDropzone';

export function RepositoryView() {
  const { projects, loading, error, reload, create, remove } = useProjects();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const active = projects.find((p) => p.id === activeId) ?? null;

  return (
    <div className="h-full overflow-auto bg-gray-950 p-4 sm:p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-white">
            <FolderGit2 size={28} className="text-blue-400" />
            소스 저장소
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            폴더 통째로 업로드 → 내부망 어디서든 다운로드
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} />새 프로젝트
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 좌측: 프로젝트 목록 */}
        <div className="space-y-3 lg:col-span-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">
            프로젝트 ({projects.length})
          </h2>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-gray-600" />
            </div>
          ) : projects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-800 bg-gray-900/30 p-8 text-center">
              <p className="text-sm text-gray-500">아직 프로젝트가 없습니다</p>
              <button
                onClick={() => setCreateOpen(true)}
                className="mt-3 text-xs text-blue-400 hover:underline"
              >
                새 프로젝트 만들기
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {projects.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  isActive={p.id === activeId}
                  onSelect={() => setActiveId(p.id)}
                  onDelete={async () => {
                    await remove(p.id);
                    if (p.id === activeId) setActiveId(null);
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* 우측: 업로드 영역 */}
        <div className="lg:col-span-2">
          {active ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-5">
                <h2 className="text-base font-semibold text-white">{active.name}</h2>
                {active.description && (
                  <p className="mt-1 text-xs text-gray-500">{active.description}</p>
                )}
                <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                  <span>파일 {active.fileCount.toLocaleString()}개</span>
                  <span>총 {(Number(active.totalSize) / 1024 / 1024).toFixed(2)} MB</span>
                  <span>마지막 업데이트 {new Date(active.updatedAt).toLocaleString()}</span>
                </div>
              </div>

              <UploadDropzone project={active} onUploaded={reload} />
            </div>
          ) : (
            <div className="flex h-full min-h-[400px] items-center justify-center rounded-xl border border-dashed border-gray-800 bg-gray-900/30">
              <div className="text-center">
                <FolderGit2 size={48} className="mx-auto text-gray-700" />
                <p className="mt-3 text-sm text-gray-500">
                  좌측에서 프로젝트를 선택하거나 새로 만드세요
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <CreateProjectModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={async (input) => {
          const p = await create(input);
          setActiveId(p.id);
        }}
      />
    </div>
  );
}
