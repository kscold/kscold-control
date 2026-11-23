import { useState } from 'react';
import { Dialog, dialogButtonClass } from '@/shared/ui';
import { formatFullDateTime } from '@/shared/lib/date-format';
import { AuditDomainIcon } from './AuditDomainIcon';
import { buildDiffEntries } from '../lib/audit-diff';
import { AUDIT_DOMAIN_LABEL, formatActor } from '../lib/audit-feed-format';
import type { AuditFeedItem } from '../model/audit.types';

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '없음';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  return JSON.stringify(value);
}

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4 py-2.5 text-sm">
      <dt className="w-16 shrink-0 text-gray-500">{label}</dt>
      <dd className="min-w-0 flex-1 break-words text-gray-200">{children}</dd>
    </div>
  );
}

interface AuditEventSheetProps {
  item: AuditFeedItem | null;
  onClose: () => void;
}

/** 기록 한 건의 자세한 내용: 언제·누가·무엇을, 바뀐 값, 남은 정보 */
export function AuditEventSheet({ item, onClose }: AuditEventSheetProps) {
  const [showRaw, setShowRaw] = useState(false);
  if (!item) return null;

  const { event } = item;
  const diff = buildDiffEntries(event.metadata);
  const details = Object.entries(event.metadata).filter(
    ([key]) => key !== 'before' && key !== 'after',
  );
  const close = () => {
    setShowRaw(false);
    onClose();
  };

  return (
    <Dialog
      open
      size="lg"
      title={event.summary}
      icon={<AuditDomainIcon domain={event.domain} />}
      description={
        item.attention ? '나중에 다시 확인해야 하는 동작입니다.' : undefined
      }
      onClose={close}
      footer={
        <button
          type="button"
          className={dialogButtonClass('neutral')}
          onClick={close}
        >
          닫기
        </button>
      }
    >
      <dl className="divide-y divide-gray-800">
        <InfoRow label="언제">
          {item.count > 1
            ? `${formatFullDateTime(item.firstAt)} ~ ${formatFullDateTime(event.createdAt)} (${item.count.toLocaleString()}번)`
            : formatFullDateTime(event.createdAt)}
        </InfoRow>
        <InfoRow label="누가">
          {item.kind === 'system'
            ? '자동 (사람이 하지 않은 일)'
            : (event.actorEmail ?? formatActor(item))}
        </InfoRow>
        <InfoRow label="분류">
          {AUDIT_DOMAIN_LABEL[event.domain] ?? event.domain}
        </InfoRow>
        {event.targetId ? (
          <InfoRow label="대상">
            {event.targetType ? `${event.targetType} · ` : ''}
            {event.targetId}
          </InfoRow>
        ) : null}
      </dl>

      {diff.length > 0 ? (
        <section className="mt-5">
          <h3 className="mb-2 text-xs font-semibold text-gray-500">
            바뀐 내용
          </h3>
          <ul className="space-y-1.5">
            {diff.map((entry) => (
              <li
                key={entry.path}
                className="rounded-lg bg-gray-950/60 px-3 py-2 text-sm"
              >
                <div className="font-mono text-xs text-gray-400">
                  {entry.path}
                </div>
                <div className="mt-1 break-words">
                  {entry.changeType !== 'added' ? (
                    <span className="text-rose-300 line-through decoration-rose-500/60">
                      {formatValue(entry.beforeValue)}
                    </span>
                  ) : null}
                  {entry.changeType === 'changed' ? (
                    <span className="mx-1.5 text-gray-600">→</span>
                  ) : null}
                  {entry.changeType !== 'removed' ? (
                    <span className="text-emerald-300">
                      {formatValue(entry.afterValue)}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {details.length > 0 ? (
        <section className="mt-5">
          <h3 className="mb-1 text-xs font-semibold text-gray-500">
            남은 정보
          </h3>
          <dl className="divide-y divide-gray-800">
            {details.map(([key, value]) => (
              <InfoRow key={key} label={key}>
                <span className="font-mono text-[13px]">
                  {formatValue(value)}
                </span>
              </InfoRow>
            ))}
          </dl>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => setShowRaw((value) => !value)}
        className="mt-5 text-xs text-gray-500 underline-offset-2 hover:text-gray-300 hover:underline"
      >
        {showRaw ? '원본 기록 닫기' : '원본 기록 보기'}
      </button>
      {showRaw ? (
        <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-gray-950 p-3 text-xs text-gray-400">
          {JSON.stringify(event, null, 2)}
        </pre>
      ) : null}
    </Dialog>
  );
}
