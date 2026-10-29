import { LayoutGrid, RefreshCw, Server } from 'lucide-react';

interface TopologyLegendProps {
  loading: boolean;
  onRefresh: () => void;
  generatedAt: number | null;
  /** 넘기지 않으면 자동 정렬 버튼을 숨김 (배치 변경 권한이 없을 때) */
  onResetLayout?: () => void;
  resettingLayout?: boolean;
}

const LEGEND_ITEMS = [
  { color: 'bg-indigo-500', label: 'Internet' },
  { color: 'bg-blue-500', label: 'Host' },
  { color: 'bg-amber-500', label: 'Nginx' },
  { color: 'bg-emerald-500', label: 'App' },
  { color: 'bg-sky-500', label: 'DB' },
];

export function TopologyLegend({
  loading,
  onRefresh,
  generatedAt,
  onResetLayout,
  resettingLayout = false,
}: TopologyLegendProps) {
  return (
    // 빈 자리는 캔버스 끌기를 막지 않도록 통과시키고, 좁은 화면에서는 범례가 다음 줄로 내려간다
    <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex flex-wrap items-center gap-2 [&>*]:pointer-events-auto">
      <div className="flex min-w-0 items-center gap-2 rounded-xl border border-gray-700 bg-gray-900/90 px-3 py-2 backdrop-blur sm:px-4">
        <Server size={16} className="shrink-0 text-sky-400" />
        <span className="truncate text-sm font-bold text-white">
          <span className="hidden sm:inline">Infrastructure </span>Topology
        </span>
      </div>

      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        aria-label="토폴로지 새로고침"
        className="shrink-0 rounded-xl border border-gray-700 bg-gray-900/90 px-3 py-2 text-gray-300 transition hover:text-white disabled:opacity-50"
      >
        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
      </button>

      {onResetLayout && (
        <button
          type="button"
          onClick={onResetLayout}
          disabled={loading || resettingLayout}
          title="옮겨 둔 노드 배치를 지우고 기본 배치로 다시 그립니다"
          className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-gray-700 bg-gray-900/90 px-3 py-2 text-xs text-gray-300 transition hover:text-white disabled:opacity-50"
        >
          <LayoutGrid size={14} />
          <span>자동 정렬</span>
        </button>
      )}

      <div className="ml-auto flex max-w-full flex-wrap items-center gap-x-2.5 gap-y-1 rounded-xl border border-gray-700 bg-gray-900/90 px-3 py-2 text-[10px] backdrop-blur">
        {LEGEND_ITEMS.map((item) => (
          <span key={item.label} className="flex items-center gap-1">
            <span
              className={`inline-block h-2 w-2 rounded-full ${item.color}`}
            />
            <span className="text-gray-400">{item.label}</span>
          </span>
        ))}
        {generatedAt ? (
          <span className="border-l border-gray-700 pl-2.5 text-gray-500">
            {new Date(generatedAt).toLocaleTimeString('ko-KR')}
          </span>
        ) : null}
      </div>
    </div>
  );
}
