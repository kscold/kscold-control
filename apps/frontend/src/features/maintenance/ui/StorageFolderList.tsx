import { formatSize } from '../lib/format';
import type { StorageFolder } from '../model/maintenance.types';

/** 맥의 큰 폴더 — 크기순으로 보여주고 가장 큰 폴더 대비 막대로 비교한다 */
export function StorageFolderList({ folders }: { folders: StorageFolder[] }) {
  const sorted = [...folders].sort(
    (left, right) => (right.sizeBytes ?? -1) - (left.sizeBytes ?? -1),
  );
  const largest = Math.max(1, ...sorted.map((folder) => folder.sizeBytes ?? 0));

  return (
    <section className="rounded-2xl border border-gray-800 bg-gray-900/70">
      <div className="border-b border-gray-800 px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold text-white">맥의 큰 폴더</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          개발 도구가 버전·세션마다 쌓아 두기 쉬운 곳입니다.
        </p>
      </div>
      <ul className="divide-y divide-gray-800">
        {sorted.map((folder) => (
          <li key={folder.key} className="px-4 py-3 sm:px-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm text-gray-100">{folder.label}</p>
                {folder.description && (
                  <p className="mt-0.5 text-xs text-gray-500">
                    {folder.description}
                  </p>
                )}
                <p className="mt-0.5 break-all font-mono text-[11px] text-gray-600">
                  {folder.path}
                </p>
              </div>
              <span className="shrink-0 text-sm tabular-nums text-gray-300">
                {folder.sizeBytes === null
                  ? '없음'
                  : formatSize(folder.sizeBytes)}
              </span>
            </div>
            {folder.sizeBytes !== null && folder.sizeBytes > 0 && (
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-gray-800">
                <div
                  className="h-full rounded-full bg-sky-500/70"
                  style={{ width: `${(folder.sizeBytes / largest) * 100}%` }}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
