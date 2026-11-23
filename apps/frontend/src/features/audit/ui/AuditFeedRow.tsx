import { ChevronRight } from 'lucide-react';
import { AuditDomainIcon } from './AuditDomainIcon';
import { formatActor, formatFeedTime } from '../lib/audit-feed-format';
import type { AuditFeedItem } from '../model/audit.types';

interface AuditFeedRowProps {
  item: AuditFeedItem;
  now: Date;
  onOpen: (item: AuditFeedItem) => void;
}

/** 한 줄 = 한 문장. 누가 · 언제 · 몇 번을 아래 줄에 작게 쓴다. */
export function AuditFeedRow({ item, now, onOpen }: AuditFeedRowProps) {
  const { event } = item;
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-800/40 active:bg-gray-800/60"
      >
        <span className="relative">
          <AuditDomainIcon domain={event.domain} />
          {item.attention ? (
            <span
              aria-label="확인할 일"
              className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-gray-900 bg-amber-400"
            />
          ) : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block break-words text-[15px] leading-snug text-gray-100">
            {event.summary}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[13px] text-gray-500">
            <span
              className={
                item.kind === 'system' ? 'text-gray-500' : 'text-gray-400'
              }
            >
              {formatActor(item)}
            </span>
            <span aria-hidden>·</span>
            <time dateTime={event.createdAt}>
              {formatFeedTime(event.createdAt, now)}
            </time>
            {item.count > 1 ? (
              <>
                <span aria-hidden>·</span>
                <span className="rounded-full bg-gray-800 px-1.5 text-xs text-gray-300">
                  {item.count.toLocaleString()}번 반복
                </span>
              </>
            ) : null}
          </span>
        </span>
        <ChevronRight
          size={16}
          className="shrink-0 text-gray-600"
          aria-hidden
        />
      </button>
    </li>
  );
}
