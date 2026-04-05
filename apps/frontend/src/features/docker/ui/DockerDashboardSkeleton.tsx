import { SkeletonBlock } from '../../../shared/ui/SkeletonBlock';

function CleanupSkeletonCard() {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <SkeletonBlock className="h-3 w-20 rounded-md" />
          <SkeletonBlock className="h-7 w-40 rounded-lg" />
        </div>
        <SkeletonBlock className="h-10 w-10 rounded-xl" />
      </div>
      <div className="mt-4 min-h-[252px] rounded-2xl border border-gray-800 bg-gray-950/60 p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <SkeletonBlock className="h-4 w-24 rounded-md" />
            <SkeletonBlock className="h-7 w-48 rounded-lg" />
          </div>
          <SkeletonBlock className="h-9 w-24 rounded-full" />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`summary-${index}`}
              className="rounded-xl border border-gray-800 bg-gray-900/70 p-4"
            >
              <SkeletonBlock className="h-3 w-20 rounded-md" />
              <SkeletonBlock className="mt-2 h-8 w-24 rounded-lg" />
              <SkeletonBlock className="mt-3 h-4 w-full rounded-md" />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="min-h-[372px] rounded-2xl border border-gray-800 bg-gray-900/70 p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <SkeletonBlock className="h-7 w-36 rounded-lg" />
              <SkeletonBlock className="h-7 w-16 rounded-full" />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, metricIndex) => (
                <div
                  key={metricIndex}
                  className="rounded-xl border border-gray-800 bg-gray-950/50 p-3"
                >
                  <SkeletonBlock className="h-3 w-14 rounded-md" />
                  <SkeletonBlock className="mt-2 h-8 w-16 rounded-md" />
                </div>
              ))}
            </div>
            <SkeletonBlock className="mt-4 h-20 w-full rounded-xl" />
            <div className="mt-4 flex gap-2">
              <SkeletonBlock className="h-11 flex-1 rounded-xl" />
              <SkeletonBlock className="h-11 w-11 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ContainerCardSkeleton() {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
      <div className="mb-3 flex items-start justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <SkeletonBlock className="h-7 w-40 rounded-lg" />
            <SkeletonBlock className="h-6 w-20 rounded-full" />
          </div>
          <SkeletonBlock className="h-4 w-36 rounded-md" />
        </div>
        <SkeletonBlock className="ml-2 h-3 w-3 rounded-full" />
      </div>

      <div className="mb-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-gray-700 bg-gray-900/40 p-3">
            <SkeletonBlock className="h-3 w-10 rounded-md" />
            <SkeletonBlock className="mt-2 h-5 w-16 rounded-md" />
          </div>
          <div className="rounded-xl border border-gray-700 bg-gray-900/40 p-3">
            <SkeletonBlock className="h-3 w-12 rounded-md" />
            <SkeletonBlock className="mt-2 h-5 w-14 rounded-md" />
          </div>
        </div>
        <div className="rounded-xl border border-gray-700 bg-gray-900/40 p-3">
          <SkeletonBlock className="h-3 w-10 rounded-md" />
          <div className="mt-2 flex flex-wrap gap-1">
            <SkeletonBlock className="h-5 w-20 rounded-md" />
            <SkeletonBlock className="h-5 w-24 rounded-md" />
            <SkeletonBlock className="h-5 w-20 rounded-md" />
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <SkeletonBlock className="h-11 flex-1 rounded-lg" />
        <SkeletonBlock className="h-11 w-11 rounded-lg" />
        <SkeletonBlock className="h-11 w-11 rounded-lg" />
      </div>
    </div>
  );
}

export function DockerDashboardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-auto bg-gray-900 p-4 sm:p-6">
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SkeletonBlock className="h-9 w-44 rounded-lg" />
        <SkeletonBlock className="h-11 w-full rounded-lg sm:w-40" />
      </div>

      <CleanupSkeletonCard />

      <div className="mb-6 mt-6 flex items-center gap-2 overflow-x-auto">
        <SkeletonBlock className="h-5 w-5 rounded-md" />
        <SkeletonBlock className="h-10 w-24 rounded-lg" />
        <SkeletonBlock className="h-10 w-28 rounded-lg" />
        <SkeletonBlock className="h-10 w-24 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <ContainerCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}
