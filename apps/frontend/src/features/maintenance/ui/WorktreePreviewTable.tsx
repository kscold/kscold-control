import { formatShortDateTime } from '@/shared/lib';
import { formatSize } from '../lib/format';
import {
  KEEP_REASON_LABELS,
  type WorktreeCleanupPreview,
} from '../model/maintenance.types';

/** 미리보기 결과 — 지울 폴더와 남길 폴더(이유 포함) */
export function WorktreePreviewTable({
  preview,
}: {
  preview: WorktreeCleanupPreview;
}) {
  const removable = preview.items.filter((item) => item.action === 'remove');
  const freed = removable.reduce((sum, item) => sum + item.sizeBytes, 0);

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-300">
        지울 폴더{' '}
        <span className="font-semibold text-amber-300">
          {removable.length}개
        </span>
        {removable.length > 0 && (
          <>
            {' '}
            · 폴더 크기 합{' '}
            <span className="font-semibold text-amber-300">
              {formatSize(freed)}
            </span>
          </>
        )}
        <span className="text-gray-500">
          {' '}
          · 남길 폴더 {preview.items.length - removable.length}개
        </span>
      </p>
      {removable.length > 0 && (
        <p className="text-[11px] text-gray-500">
          pnpm 이 설치한 node_modules 처럼 여러 폴더가 디스크 블록을 나눠 쓰면
          실제로 늘어나는 여유 공간은 폴더 크기 합보다 적습니다. 실행 후 이력에
          실제 값을 적습니다.
        </p>
      )}
      {preview.staleRepositories.length > 0 && (
        <p className="text-[11px] text-amber-300/80">
          원격 상태를 새로 받지 못한 저장소가 있어 예전 상태로 판단했습니다 (덜
          지우는 쪽): {preview.staleRepositories.join(', ')}
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="text-gray-500">
            <tr>
              <th className="px-3 py-2 font-medium">폴더</th>
              <th className="px-3 py-2 font-medium">브랜치</th>
              <th className="px-3 py-2 font-medium">마지막 작업</th>
              <th className="px-3 py-2 font-medium">크기</th>
              <th className="px-3 py-2 font-medium">판단</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/70">
            {preview.items.map((item) => (
              <tr key={item.name} className="text-gray-300">
                <td className="px-3 py-2 font-mono text-white">{item.name}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-gray-400">
                  {item.branch ?? '(분리된 HEAD)'}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-400">
                  {formatShortDateTime(item.lastActivityAt, '-')}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-400">
                  {formatSize(item.sizeBytes)}
                </td>
                <td className="px-3 py-2">
                  {item.action === 'remove' ? (
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-200">
                      정리
                    </span>
                  ) : (
                    <span className="flex flex-wrap gap-1" title={item.detail}>
                      {item.reasons.map((reason) => (
                        <span
                          key={reason}
                          className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-200"
                        >
                          {KEEP_REASON_LABELS[reason]}
                        </span>
                      ))}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
