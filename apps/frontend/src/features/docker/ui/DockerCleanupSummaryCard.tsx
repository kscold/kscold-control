import { Sparkles, Trash2 } from 'lucide-react';
import type { DockerCleanupCandidates } from '../lib/docker-cleanup.types';
import { formatBytes } from '../../dashboard/lib/dashboard.utils';

interface DockerCleanupSummaryCardProps {
  candidates: DockerCleanupCandidates;
}

export function DockerCleanupSummaryCard({
  candidates,
}: DockerCleanupSummaryCardProps) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Trash2 size={16} className="text-amber-300" />
            <span>안전 정리 후보</span>
          </div>
          <h3 className="mt-2 text-lg font-semibold text-white">
            Docker/배포 부산물 현황
          </h3>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
          후보 {candidates.summary.totalCandidates}개
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-gray-400">
            예상 절감량
          </p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {formatBytes(candidates.summary.reclaimableBytes)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-gray-400">
            보기 전용
          </p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {formatBytes(candidates.summary.readOnlyBytes)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-gray-400">
            <Sparkles size={14} className="text-amber-300" />
            <span>부분 실패</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-white">
            {candidates.summary.warningCount}
          </p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-gray-400">
            <Sparkles size={14} className="text-cyan-300" />
            <span>운영 기준</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-gray-300">
            볼륨과 운영 파일은 건드리지 않고, Docker 엔진 리소스만 정리합니다.
          </p>
        </div>
      </div>
    </div>
  );
}
