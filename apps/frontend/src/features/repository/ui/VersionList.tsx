import { useEffect, useState, useCallback } from 'react';
import { History, Trash2, Loader2, PackageOpen } from 'lucide-react';
import { repositoryService } from '../../../services/api/repository.service';
import { formatBytes } from '../lib/file-filter';
import { formatFullDateTime } from '../../../lib/date-format';
import type { ProjectVersion } from '../lib/repository.types';

interface VersionListProps {
  projectId: string;
}

export function VersionList({ projectId }: VersionListProps) {
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const items = await repositoryService.listVersions(projectId);
      setVersions(items);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCleanup = async () => {
    if (versions.length <= 1) return;
    const ok = window.confirm(
      `최신 버전 1개를 남기고 나머지 ${versions.length - 1}개를 삭제합니다. 계속하시겠습니까?`,
    );
    if (!ok) return;
    setCleaning(true);
    try {
      const { deleted } = await repositoryService.cleanupVersions(projectId);
      alert(`${deleted}개의 이전 버전이 삭제되었습니다.`);
      await load();
    } catch {
      alert('버전 삭제에 실패했습니다.');
    } finally {
      setCleaning(false);
    }
  };


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
          <History size={15} />
          버전 히스토리
          {!loading && (
            <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
              {versions.length}개
            </span>
          )}
        </div>
        {versions.length > 1 && (
          <button
            onClick={handleCleanup}
            disabled={cleaning}
            className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cleaning ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Trash2 size={12} />
            )}
            이전 버전 모두 삭제
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="animate-spin text-gray-600" />
        </div>
      ) : versions.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-600">
          <PackageOpen size={36} />
          <p className="text-sm">저장된 버전이 없습니다</p>
          <p className="text-xs text-gray-700">
            업로드를 완료하면 자동으로 스냅샷이 생성됩니다
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {versions.map((v, idx) => (
            <div
              key={v.id}
              className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900/50 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                    idx === 0
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-gray-800 text-gray-500'
                  }`}
                >
                  {idx === 0 ? '★' : versions.length - idx}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-200">
                    {idx === 0 ? (
                      <span className="mr-2 rounded bg-emerald-500/20 px-1.5 py-0.5 text-xs text-emerald-400">
                        최신
                      </span>
                    ) : null}
                    {formatFullDateTime(v.createdAt)}
                  </p>
                  <p className="text-xs text-gray-600">{v.filename}</p>
                </div>
              </div>
              <span className="text-xs text-gray-500">
                {formatBytes(v.compressedSize)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
