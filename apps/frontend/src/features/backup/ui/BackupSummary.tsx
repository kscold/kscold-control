import {
  AlertTriangle,
  CalendarClock,
  Database,
  HardDrive,
} from 'lucide-react';
import { formatBytes, formatShortDateTime } from '@/shared/lib';
import { formatRelativeTime } from '../lib/backup-format';
import type { BackupTargetStatus } from '../model/backup.types';

interface BackupSummaryProps {
  items: BackupTargetStatus[];
  now: Date;
}

/** 백업 현황을 네 가지 숫자로 요약한다. */
export function BackupSummary({ items, now }: BackupSummaryProps) {
  const enabledCount = items.filter((item) => item.enabled).length;
  const archives = items.flatMap((item) => item.archives);
  const totalBytes = archives.reduce(
    (sum, archive) => sum + archive.sizeBytes,
    0,
  );
  const failedTargets = items.filter(
    (item) => item.lastRun?.status === 'failed',
  );
  const neverRun = items.filter((item) => item.enabled && !item.lastRun);
  const nextTarget = items
    .filter((item) => item.nextRunAt)
    .sort(
      (left, right) =>
        Date.parse(left.nextRunAt as string) -
        Date.parse(right.nextRunAt as string),
    )[0];

  const cards = [
    {
      icon: Database,
      label: '백업 대상',
      value: `${enabledCount}개 사용 중`,
      detail:
        items.length === enabledCount
          ? `전체 ${items.length}개`
          : `전체 ${items.length}개 · ${items.length - enabledCount}개 일시 중지`,
      tone: 'text-emerald-300',
    },
    {
      icon: CalendarClock,
      label: '다음 예약 실행',
      value: nextTarget?.nextRunAt
        ? formatShortDateTime(nextTarget.nextRunAt)
        : '예약 없음',
      detail: nextTarget?.nextRunAt
        ? `${nextTarget.name} · ${formatRelativeTime(nextTarget.nextRunAt, now)}`
        : '사용 중인 대상이 없습니다',
      tone: 'text-sky-300',
    },
    {
      icon: HardDrive,
      label: '보관 중인 백업',
      value: `${archives.length}개`,
      detail: archives.length > 0 ? formatBytes(totalBytes) : '아직 없습니다',
      tone: 'text-violet-300',
    },
    {
      icon: AlertTriangle,
      label: '최근 실행 상태',
      value:
        failedTargets.length > 0
          ? `실패 ${failedTargets.length}개`
          : items.some((item) => item.lastRun)
            ? '모두 정상'
            : '실행 기록 없음',
      detail:
        failedTargets.length > 0
          ? failedTargets.map((item) => item.name).join(', ')
          : neverRun.length > 0
            ? `아직 실행 전 ${neverRun.length}개`
            : '대상별 마지막 실행 기준',
      tone: failedTargets.length > 0 ? 'text-red-300' : 'text-emerald-300',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4"
          >
            <div className="flex items-center gap-2 text-xs font-medium text-gray-400">
              <Icon size={14} className={card.tone} />
              {card.label}
            </div>
            <p className={`mt-2 text-xl font-semibold ${card.tone}`}>
              {card.value}
            </p>
            <p className="mt-1 truncate text-xs text-gray-500">{card.detail}</p>
          </div>
        );
      })}
    </div>
  );
}
