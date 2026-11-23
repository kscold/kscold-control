import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronRight,
  Download,
  Loader2,
  RefreshCw,
  ScrollText,
  Search,
  X,
} from 'lucide-react';
import { Dialog, dialogButtonClass } from '@/shared/ui';
import { auditService } from '../api/audit.service';
import { downloadAuditExport } from '../lib/audit-export';
import {
  AUDIT_DOMAIN_LABEL,
  AUDIT_PERIOD_LABEL,
  groupFeedByDay,
} from '../lib/audit-feed-format';
import { useAuditFeed } from '../model/useAuditFeed';
import type {
  AuditEventDomain,
  AuditFeedItem,
  AuditFeedPeriod,
  AuditFeedView as FeedView,
} from '../model/audit.types';
import { AuditEventSheet } from './AuditEventSheet';
import { AuditFeedRow } from './AuditFeedRow';

const VIEWS: { value: FeedView; label: string }[] = [
  { value: 'human', label: '사람이 한 일' },
  { value: 'attention', label: '확인할 일' },
  { value: 'system', label: '자동' },
  { value: 'all', label: '전체' },
];

const EMPTY_MESSAGE: Record<FeedView, string> = {
  attention:
    '확인할 일이 없습니다. 비밀값 열람·권한 변경·차단 해제 같은 동작이 생기면 여기에 모입니다.',
  human: '이 기간에 사람이 한 일이 없습니다.',
  system: '이 기간에 자동으로 된 일이 없습니다.',
  all: '이 기간에 남은 기록이 없습니다.',
};

const PERIODS = Object.keys(AUDIT_PERIOD_LABEL) as AuditFeedPeriod[];
const DOMAINS = Object.keys(AUDIT_DOMAIN_LABEL) as AuditEventDomain[];

function chipClass(active: boolean) {
  return `shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors ${
    active
      ? 'border-white bg-white font-medium text-gray-950'
      : 'border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-700 hover:text-gray-200'
  }`;
}

/** 운영 기록: 확인할 일을 먼저 보여 주고, 사람·자동을 나눠 한 문장씩 읽게 한다. */
export function AuditFeedView() {
  const state = useAuditFeed();
  const { feed, view, loading } = state;
  const [selected, setSelected] = useState<AuditFeedItem | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState<'json' | 'csv' | null>(null);
  const now = useMemo(() => new Date(), [feed]);
  const days = useMemo(
    () => groupFeedByDay(feed?.items ?? [], now),
    [feed, now],
  );
  const attentionCount = feed?.counts.attention ?? 0;

  const handleExport = async (format: 'json' | 'csv') => {
    setExporting(format);
    try {
      downloadAuditExport(
        await auditService.exportEvents(state.exportFilters),
        format,
      );
      setExportOpen(false);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="h-full overflow-auto bg-gray-950">
      <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 sm:py-8">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2.5 text-xl font-bold text-white sm:text-2xl">
              <ScrollText size={22} className="shrink-0 text-emerald-400" />
              운영 기록
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              누가 언제 무엇을 바꿨는지 봅니다.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => void state.reload()}
              aria-label="새로고침"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-800 bg-gray-900 text-gray-400 hover:text-white"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={() => setExportOpen(true)}
              aria-label="내보내기"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-800 bg-gray-900 text-gray-400 hover:text-white"
            >
              <Download size={16} />
            </button>
          </div>
        </header>

        {attentionCount > 0 && view !== 'attention' ? (
          <button
            type="button"
            onClick={() => state.setView('attention')}
            className="mt-5 flex w-full items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-left transition-colors hover:bg-amber-500/15"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-300">
              <AlertTriangle size={19} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-amber-100">
                확인할 일 {attentionCount.toLocaleString()}건
              </span>
              <span className="block text-[13px] text-amber-200/70">
                비밀값 열람·권한 변경·차단 해제·삭제가 있었어요
              </span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-amber-300/70" />
          </button>
        ) : null}

        <div
          role="tablist"
          aria-label="기록 보기"
          className="mt-5 grid grid-cols-4 gap-1 rounded-xl bg-gray-900 p-1"
        >
          {VIEWS.map((option) => {
            const active = view === option.value;
            const count = feed?.counts[option.value];
            return (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => state.setView(option.value)}
                className={`min-w-0 rounded-lg px-1 py-2 text-[13px] transition-colors sm:text-sm ${
                  active
                    ? 'bg-gray-700 font-semibold text-white'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <span className="block truncate">{option.label}</span>
                <span
                  className={`block text-xs ${active ? 'text-gray-300' : 'text-gray-600'}`}
                >
                  {count === undefined ? '–' : count.toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>

        <label className="relative mt-3 block">
          <span className="sr-only">기록 검색</span>
          <Search
            size={17}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500"
          />
          {/* 휴대폰에서 입력할 때 화면이 확대되지 않도록 글자를 16px 로 둔다. */}
          <input
            type="search"
            value={state.searchInput}
            onChange={(event) => state.setSearchInput(event.target.value)}
            placeholder="IP, 이름, 내용으로 찾기"
            className="h-11 w-full rounded-xl border border-gray-800 bg-gray-900 pl-10 pr-10 text-base text-white placeholder:text-gray-600 focus:border-gray-600 focus:outline-none"
          />
          {state.searchInput ? (
            <button
              type="button"
              aria-label="검색어 지우기"
              onClick={() => state.setSearchInput('')}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-gray-500 hover:text-white"
            >
              <X size={16} />
            </button>
          ) : null}
        </label>

        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {PERIODS.map((period) => (
            <button
              key={period}
              type="button"
              aria-pressed={state.period === period}
              onClick={() => state.setPeriod(period)}
              className={chipClass(state.period === period)}
            >
              {AUDIT_PERIOD_LABEL[period]}
            </button>
          ))}
          <span
            aria-hidden
            className="mx-1 w-px shrink-0 self-stretch bg-gray-800"
          />
          <button
            type="button"
            aria-pressed={state.domain === 'all'}
            onClick={() => state.setDomain('all')}
            className={chipClass(state.domain === 'all')}
          >
            모든 분류
          </button>
          {DOMAINS.map((domain) => (
            <button
              key={domain}
              type="button"
              aria-pressed={state.domain === domain}
              onClick={() => state.setDomain(domain)}
              className={chipClass(state.domain === domain)}
            >
              {AUDIT_DOMAIN_LABEL[domain]}
            </button>
          ))}
        </div>

        {state.error ? (
          <div
            role="alert"
            className="mt-5 rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300"
          >
            {state.error}
          </div>
        ) : null}

        <div className="mt-5">
          {!feed && loading ? (
            <div className="flex justify-center py-16">
              <Loader2 size={24} className="animate-spin text-gray-600" />
            </div>
          ) : days.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-800 px-6 py-14 text-center text-sm leading-6 text-gray-500">
              {state.search
                ? `"${state.search}"에 맞는 기록이 없습니다.`
                : EMPTY_MESSAGE[view]}
            </div>
          ) : (
            <div className="space-y-5">
              {days.map((day) => (
                <section key={day.heading}>
                  <h2 className="mb-2 px-1 text-[13px] font-semibold text-gray-500">
                    {day.heading}
                  </h2>
                  <ul className="divide-y divide-gray-800/70 overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
                    {day.items.map((item) => (
                      <AuditFeedRow
                        key={item.event.id}
                        item={item}
                        now={now}
                        onOpen={setSelected}
                      />
                    ))}
                  </ul>
                </section>
              ))}
              {feed?.hasMore ? (
                <button
                  type="button"
                  onClick={state.loadMore}
                  disabled={loading}
                  className="w-full rounded-xl border border-gray-800 bg-gray-900 py-3 text-sm text-gray-300 hover:text-white disabled:opacity-50"
                >
                  {loading ? '불러오는 중…' : '더 보기'}
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <AuditEventSheet item={selected} onClose={() => setSelected(null)} />

      <Dialog
        open={exportOpen}
        title="기록 내보내기"
        description="지금 고른 기간·분류·검색어에 맞는 기록을 파일로 받습니다. 반복 기록도 묶지 않고 모두 들어갑니다."
        icon={<Download size={18} />}
        busy={exporting !== null}
        onClose={() => setExportOpen(false)}
        footer={
          <>
            <button
              type="button"
              className={dialogButtonClass('neutral')}
              onClick={() => void handleExport('json')}
              disabled={exporting !== null}
            >
              {exporting === 'json' ? '만드는 중…' : 'JSON'}
            </button>
            <button
              type="button"
              className={dialogButtonClass('emerald')}
              onClick={() => void handleExport('csv')}
              disabled={exporting !== null}
            >
              {exporting === 'csv' ? '만드는 중…' : 'CSV (엑셀)'}
            </button>
          </>
        }
      />
    </div>
  );
}
