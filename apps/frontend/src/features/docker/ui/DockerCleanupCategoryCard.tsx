import { Eye, PlayCircle } from 'lucide-react';
import { formatBytes } from '../../../shared/lib';
import type {
  DockerCleanupCategory,
  DockerCleanupResult,
} from '../lib/docker-cleanup.types';
import type { DockerCleanupActionKey } from '../hooks/useDockerCleanupActions';
import { DockerCleanupItemRow } from './DockerCleanupItemRow';

interface DockerCleanupCategoryCardProps {
  title: string;
  description: string;
  category: DockerCleanupCategory;
  actionKey?: DockerCleanupActionKey;
  result?: DockerCleanupResult;
  loading?: boolean;
  onPreview?: (key: DockerCleanupActionKey) => void;
  onExecute?: (key: DockerCleanupActionKey) => void;
}

export function DockerCleanupCategoryCard({
  title,
  description,
  category,
  actionKey,
  result,
  loading,
  onPreview,
  onExecute,
}: DockerCleanupCategoryCardProps) {
  const isReadOnly = !actionKey;
  const previewItems = category.items.slice(0, 4);

  return (
    <div className="min-h-[372px] rounded-2xl border border-gray-800 bg-gray-950/60 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-base font-semibold text-white">{title}</h4>
            {isReadOnly ? (
              <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[11px] text-cyan-100">
                보기 전용
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-sm leading-6 text-gray-400">{description}</p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xs text-gray-500">예상 절감량</p>
          <p className="mt-1 text-lg font-semibold text-amber-300">
            {formatBytes(category.reclaimableBytes)}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-3">
          <p className="text-xs text-gray-500">항목 수</p>
          <p className="mt-1 text-lg font-semibold text-white">
            {category.items.length}
          </p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-3">
          <p className="text-xs text-gray-500">총 용량</p>
          <p className="mt-1 text-lg font-semibold text-white">
            {formatBytes(category.totalBytes)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-3">
          <p className="text-xs text-gray-500">최근 계산</p>
          <p className="mt-1 text-sm font-medium text-white">
            {result
              ? `${result.dryRun ? '예상' : '실행'} ${formatBytes(result.reclaimedBytes)}`
              : '아직 없음'}
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {previewItems.length ? (
          previewItems.map((item) => <DockerCleanupItemRow key={item.id} item={item} />)
        ) : (
          <li className="rounded-lg border border-dashed border-gray-800 px-3 py-4 text-sm text-gray-500">
            현재 후보가 없습니다.
          </li>
        )}
      </ul>

      {category.items.length > previewItems.length ? (
        <p className="mt-3 text-xs text-gray-500">
          외 {category.items.length - previewItems.length}개 항목이 더 있습니다.
        </p>
      ) : null}

      {!isReadOnly ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading || !actionKey}
            onClick={() => actionKey && onPreview?.(actionKey)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-200 transition hover:bg-gray-800 disabled:opacity-50"
          >
            <Eye size={16} />
            예상 절감량 보기
          </button>
          <button
            type="button"
            disabled={loading || !actionKey || category.items.length === 0}
            onClick={() => actionKey && onExecute?.(actionKey)}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-gray-950 transition hover:bg-amber-400 disabled:opacity-50"
          >
            <PlayCircle size={16} />
            안전 정리 실행
          </button>
        </div>
      ) : null}
    </div>
  );
}
