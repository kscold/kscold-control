import { Filter } from 'lucide-react';

type DockerFilterType = 'all' | 'managed' | 'external';

interface DockerContainerFiltersProps {
  filter: DockerFilterType;
  stats: {
    total: number;
    managed: number;
    external: number;
  };
  onChange: (filter: DockerFilterType) => void;
}

export function DockerContainerFilters({
  filter,
  stats,
  onChange,
}: DockerContainerFiltersProps) {
  return (
    <div className="mb-6 flex items-center gap-2 overflow-x-auto">
      <Filter size={18} className="flex-shrink-0 text-gray-400" />
      <button
        onClick={() => onChange('all')}
        className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${
          filter === 'all'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
        }`}
      >
        전체 ({stats.total})
      </button>
      <button
        onClick={() => onChange('managed')}
        className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${
          filter === 'managed'
            ? 'bg-green-600 text-white'
            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
        }`}
      >
        관리중 ({stats.managed})
      </button>
      <button
        onClick={() => onChange('external')}
        className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${
          filter === 'external'
            ? 'bg-amber-600 text-white'
            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
        }`}
      >
        외부 ({stats.external})
      </button>
    </div>
  );
}
