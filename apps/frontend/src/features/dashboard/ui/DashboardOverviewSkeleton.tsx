import { SkeletonBlock } from '../../../shared/ui/SkeletonBlock';

function MetricSkeleton({
  tall = false,
  withProgress = true,
}: {
  tall?: boolean;
  withProgress?: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-3">
        <SkeletonBlock className="h-5 w-5 rounded-md" />
        <SkeletonBlock className="h-4 w-20 rounded-md" />
      </div>
      <SkeletonBlock
        className={`rounded-lg ${tall ? 'h-12 w-44' : 'h-12 w-28'}`}
      />
      {withProgress ? (
        <SkeletonBlock className="mt-3 h-2 w-full rounded-full" />
      ) : null}
      <SkeletonBlock className="mt-3 h-3 w-24 rounded-md" />
      {tall ? (
        <>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="rounded-lg border border-gray-800 bg-gray-950/60 p-3"
              >
                <SkeletonBlock className="h-3 w-20 rounded-md" />
                <SkeletonBlock className="mt-2 h-6 w-24 rounded-md" />
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <SkeletonBlock key={index} className="h-4 w-24 rounded-md" />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

export function DashboardOverviewSkeleton() {
  return (
    <div className="h-full overflow-auto bg-gray-950 p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between sm:mb-6">
        <SkeletonBlock className="h-9 w-40 rounded-lg" />
        <div className="flex items-center gap-3">
          <SkeletonBlock className="hidden h-4 w-24 rounded-md sm:block" />
          <SkeletonBlock className="hidden h-4 w-24 rounded-md sm:block" />
          <SkeletonBlock className="h-10 w-10 rounded-lg" />
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:mb-5 sm:gap-4 lg:grid-cols-4">
        <MetricSkeleton withProgress={false} />
        <MetricSkeleton />
        <MetricSkeleton />
        <MetricSkeleton tall />
      </div>

      <div className="mb-6 rounded-2xl border border-gray-800 bg-gray-950/60 p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <SkeletonBlock className="h-6 w-40 rounded-lg" />
            <SkeletonBlock className="h-4 w-72 max-w-full rounded-md" />
            <SkeletonBlock className="h-3 w-24 rounded-md" />
          </div>
          <div className="space-y-2">
            <SkeletonBlock className="h-4 w-24 rounded-md" />
            <SkeletonBlock className="h-6 w-20 rounded-md" />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="rounded-xl border border-gray-800 bg-gray-900 p-4"
            >
              <div className="flex items-center gap-2">
                <SkeletonBlock className="h-4 w-4 rounded-md" />
                <SkeletonBlock className="h-4 w-20 rounded-md" />
              </div>
              <SkeletonBlock className="mt-3 h-8 w-24 rounded-lg" />
              <div className="mt-3 flex flex-wrap gap-2">
                <SkeletonBlock className="h-3 w-16 rounded-md" />
                <SkeletonBlock className="h-3 w-16 rounded-md" />
                <SkeletonBlock className="h-3 w-24 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div
            key={index}
            className="rounded-xl border border-gray-800 bg-gray-900 p-6"
          >
            <SkeletonBlock className="h-6 w-36 rounded-lg" />
            <SkeletonBlock className="mt-3 h-4 w-40 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
