import { Trash2, ArrowRight } from 'lucide-react';
import type { PortMapping } from '../model/network.types';

interface PortMappingListProps {
  mappings: PortMapping[];
  loading: boolean;
  error: string;
  canWrite: boolean;
  canMutate: boolean;
  deleting: string | null;
  onDelete: (mapping: PortMapping) => void;
}

export function PortMappingList({
  mappings,
  loading,
  error,
  onDelete,
  canWrite,
  canMutate,
  deleting,
}: PortMappingListProps) {
  if (!mappings.length) {
    return (
      <div
        role="status"
        className="rounded-xl border border-dashed border-gray-800 px-4 py-10 text-center text-sm text-gray-400"
      >
        {loading
          ? '공유기에서 포트 매핑을 확인하고 있습니다.'
          : error
            ? '조회 결과가 없어 목록을 표시할 수 없습니다. 다시 조회해 주세요.'
            : '등록된 UPnP 동적 포트 매핑이 없습니다.'}
      </div>
    );
  }

  return (
    <div className="grid gap-3" aria-busy={loading}>
      {(error || loading) && (
        <p className="text-xs text-amber-300">
          이전 조회 결과입니다. 상태 확인 전까지 변경 작업이 잠깁니다.
        </p>
      )}
      {mappings.map((mapping) => (
        <article
          key={`${mapping.publicPort}-${mapping.protocol}`}
          className="min-w-0 rounded-xl border border-gray-800 bg-gray-900 p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${mapping.enabled ? 'bg-emerald-400' : 'bg-gray-500'}`}
              />
              <span className="rounded bg-blue-950 px-2 py-1 font-mono text-xs text-blue-300">
                {mapping.protocol}
              </span>
              <span className="text-xs text-gray-400">
                {mapping.enabled ? '활성' : '비활성'}
              </span>
              {mapping.local && (
                <span className="text-xs text-gray-400">로컬</span>
              )}
            </div>
            {canWrite && (
              <button
                onClick={() => onDelete(mapping)}
                disabled={!canMutate}
                aria-label={`${mapping.protocol} ${mapping.publicPort} 매핑 삭제`}
                className="shrink-0 rounded-lg p-2 text-red-400 hover:bg-red-950 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {deleting === `${mapping.publicPort}-${mapping.protocol}` ? (
                  '삭제 중'
                ) : (
                  <Trash2 size={16} />
                )}
              </button>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 font-mono text-base text-white">
            <span>
              <span className="mr-2 font-sans text-xs text-gray-500">외부</span>
              {mapping.publicPort}
            </span>
            <ArrowRight size={15} className="shrink-0 text-gray-500" />
            <span className="min-w-0 break-all">
              <span className="mr-2 font-sans text-xs text-gray-500">내부</span>
              {mapping.privateHost}:{mapping.privatePort}
            </span>
          </div>
          <p className="mt-2 break-words text-sm text-gray-400">
            {mapping.description || '설명 없음'}
          </p>
        </article>
      ))}
    </div>
  );
}
