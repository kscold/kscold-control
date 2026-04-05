import { TopologyCanvas } from './TopologyCanvas';
import { TopologyLegend } from './TopologyLegend';
import { TopologySkeleton } from './TopologySkeleton';
import { useTopologySnapshot } from '../hooks/useTopologySnapshot';

export function TopologyView() {
  const { snapshot, loading, error, reload } = useTopologySnapshot();
  const showSkeleton = loading && !snapshot && !error;

  return (
    <div className="h-full w-full bg-gray-950 relative">
      {showSkeleton ? null : (
        <TopologyLegend
          loading={loading}
          onRefresh={reload}
          generatedAt={snapshot?.summary.generatedAt ?? null}
        />
      )}

      {error ? (
        <div className="flex h-full items-center justify-center px-4">
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-6 py-4 text-sm text-red-100">
            {error}
          </div>
        </div>
      ) : showSkeleton ? (
        <TopologySkeleton />
      ) : (
        <TopologyCanvas snapshot={snapshot} />
      )}
    </div>
  );
}
