import { useState } from 'react';
import { Eye, PlayCircle } from 'lucide-react';
import { formatBytes } from '@/shared/lib';
import type {
  DockerCleanupCategory,
  DockerCleanupResult,
} from '@/entities/container';
import type { DockerCleanupActionKey } from '../model/useDockerCleanupActions';
import { DockerCleanupItemRow } from './DockerCleanupItemRow';

interface DockerCleanupCategoryCardProps {
  title: string;
  description: string;
  category: DockerCleanupCategory;
  actionKey?: DockerCleanupActionKey;
  result?: DockerCleanupResult;
  loading?: boolean;
  onPreview?: (key: DockerCleanupActionKey) => void;
  onExecute?: (
    key: DockerCleanupActionKey,
    selected?: { id: string; label: string }[],
  ) => void;
  /** 한꺼번에 지우지 않고 하나씩 골라 지우는 분류(종료된 컨테이너) */
  selectable?: boolean;
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
  selectable = false,
}: DockerCleanupCategoryCardProps) {
  const isReadOnly = !actionKey;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // 고를 수 있는 분류는 모든 항목을 보여 줘야 무엇을 지우는지 알 수 있다.
  const previewItems = selectable ? category.items : category.items.slice(0, 4);
  const selected = category.items.filter((item) =>
    selectedIds.includes(item.id),
  );
  const toggle = (id: string) =>
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );

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

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
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
          previewItems.map((item) =>
            selectable && !isReadOnly ? (
              <li key={item.id}>
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    aria-label={`${item.label} 고르기`}
                    checked={selectedIds.includes(item.id)}
                    onChange={() => toggle(item.id)}
                    className="h-4 w-4 shrink-0 accent-amber-500"
                  />
                  <ul className="min-w-0 flex-1">
                    <DockerCleanupItemRow item={item} />
                  </ul>
                </label>
              </li>
            ) : (
              <DockerCleanupItemRow key={item.id} item={item} />
            ),
          )
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
            disabled={
              loading ||
              !actionKey ||
              !onExecute ||
              (selectable ? selected.length === 0 : category.items.length === 0)
            }
            onClick={() => {
              if (!actionKey) return;
              if (!selectable) {
                onExecute?.(actionKey);
                return;
              }
              onExecute?.(
                actionKey,
                selected.map((item) => ({ id: item.id, label: item.label })),
              );
              setSelectedIds([]);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-gray-950 transition hover:bg-amber-400 disabled:opacity-50"
          >
            <PlayCircle size={16} />
            {selectable ? `고른 ${selected.length}개 지우기` : '안전 정리 실행'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
