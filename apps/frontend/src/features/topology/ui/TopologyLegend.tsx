import { Cpu, Database, RefreshCw, Server } from 'lucide-react';

interface TopologyLegendProps {
  loading: boolean;
  onRefresh: () => void;
  generatedAt: number | null;
}

const LEGEND_ITEMS = [
  { color: 'bg-indigo-500', label: 'Internet' },
  { color: 'bg-blue-500', label: 'Host' },
  { color: 'bg-amber-500', label: 'Nginx' },
  { color: 'bg-emerald-500', label: 'App' },
  { color: 'bg-sky-500', label: 'DB' },
  { color: 'bg-violet-500', label: 'Service' },
];

export function TopologyLegend({
  loading,
  onRefresh,
  generatedAt,
}: TopologyLegendProps) {
  return (
    <div className="absolute left-3 right-3 top-3 z-10 flex items-center gap-2">
      <div className="flex flex-shrink-0 items-center gap-2 rounded-xl border border-gray-700 bg-gray-900/90 px-4 py-2 backdrop-blur">
        <Server size={16} className="text-purple-400" />
        <span className="text-sm font-bold text-white">Infrastructure Topology</span>
      </div>

      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        aria-label="토폴로지 새로고침"
        className="flex-shrink-0 rounded-xl border border-gray-700 bg-gray-900/90 px-3 py-2 text-gray-300 transition hover:text-white disabled:opacity-50"
      >
        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
      </button>

      <div className="ml-auto flex flex-wrap items-center gap-x-2.5 gap-y-1 overflow-hidden rounded-xl border border-gray-700 bg-gray-900/90 px-3 py-2 text-[10px] backdrop-blur">
        {LEGEND_ITEMS.map((item) => (
          <span key={item.label} className="flex items-center gap-1">
            <span className={`inline-block h-2 w-2 rounded-full ${item.color}`} />
            <span className="text-gray-400">{item.label}</span>
          </span>
        ))}
        <span className="flex items-center gap-1 border-l border-gray-700 pl-2.5">
          <Cpu size={9} className="text-indigo-400" />
          <span className="text-gray-400">PM2</span>
        </span>
        <span className="flex items-center gap-1">
          <Database size={9} className="text-violet-400" />
          <span className="text-gray-400">Services</span>
        </span>
        {generatedAt ? (
          <span className="border-l border-gray-700 pl-2.5 text-gray-500">
            {new Date(generatedAt).toLocaleTimeString('ko-KR')}
          </span>
        ) : null}
      </div>
    </div>
  );
}
