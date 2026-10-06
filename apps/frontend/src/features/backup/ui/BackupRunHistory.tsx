import { History } from 'lucide-react';
import { formatBytes, formatShortDateTime } from '@/shared/lib';
import {
  describeRunOrigin,
  formatRunDuration,
  getRunStatusPresentation,
} from '../lib/backup-format';
import { ALL_TARGETS } from '../model/useBackupManagement';
import type { BackupRun, BackupTargetStatus } from '../model/backup.types';

interface BackupRunHistoryProps {
  runs: BackupRun[];
  targets: BackupTargetStatus[];
  filter: string;
  onFilterChange: (targetId: string) => void;
}

/** 최근 실행 이력. 대상별로 걸러 볼 수 있다. */
export function BackupRunHistory({
  runs,
  targets,
  filter,
  onFilterChange,
}: BackupRunHistoryProps) {
  return (
    <section className="rounded-2xl border border-gray-800 bg-gray-900/70">
      <div className="flex flex-col gap-3 border-b border-gray-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <History size={16} className="text-gray-400" />
          실행 이력
          <span className="text-xs font-normal text-gray-500">
            최근 {runs.length}건
          </span>
        </h2>
        <label className="flex items-center gap-2 text-xs text-gray-400">
          대상
          <select
            value={filter}
            onChange={(event) => onFilterChange(event.target.value)}
            className="rounded-lg border border-gray-700 bg-gray-950 px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value={ALL_TARGETS}>전체</option>
            {targets.map((target) => (
              <option key={target.id} value={target.id}>
                {target.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {runs.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-gray-500">
          아직 실행 기록이 없습니다.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs text-gray-500">
              <tr>
                <th className="px-5 py-2.5 font-medium">시작</th>
                <th className="px-3 py-2.5 font-medium">대상</th>
                <th className="px-3 py-2.5 font-medium">구분</th>
                <th className="px-3 py-2.5 font-medium">결과</th>
                <th className="px-3 py-2.5 font-medium">소요</th>
                <th className="px-3 py-2.5 font-medium">크기</th>
                <th className="px-5 py-2.5 font-medium">내용</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/70">
              {runs.map((run) => {
                const status = getRunStatusPresentation(run.status);
                return (
                  <tr key={run.id} className="align-top text-gray-300">
                    <td className="whitespace-nowrap px-5 py-3 text-gray-400">
                      {formatShortDateTime(run.startedAt)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-white">
                      {run.targetName ?? '-'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs">
                      {describeRunOrigin(run)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-gray-400">
                      {formatRunDuration(run.startedAt, run.finishedAt) || '-'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-gray-400">
                      {run.archiveSizeBytes !== null
                        ? formatBytes(run.archiveSizeBytes)
                        : '-'}
                    </td>
                    <td className="px-5 py-3 text-xs leading-5 text-gray-400">
                      {run.message || '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
