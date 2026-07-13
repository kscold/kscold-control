import type { DockerCleanupCandidateItem } from '@/entities/container';
import { formatBytes } from '../../../shared/lib';

interface DockerCleanupItemRowProps {
  item: DockerCleanupCandidateItem;
}

export function DockerCleanupItemRow({ item }: DockerCleanupItemRowProps) {
  return (
    <li className="flex items-start justify-between gap-3 rounded-lg border border-gray-800 bg-gray-950/60 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-white">{item.label}</p>
        {item.detail ? (
          <p className="mt-1 break-all text-xs text-gray-400">{item.detail}</p>
        ) : null}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-xs font-medium text-gray-300">
          {formatBytes(item.size)}
        </p>
        {item.reclaimable !== undefined ? (
          <p className="mt-1 text-[11px] text-amber-300">
            {formatBytes(item.reclaimable)}
          </p>
        ) : null}
      </div>
    </li>
  );
}
