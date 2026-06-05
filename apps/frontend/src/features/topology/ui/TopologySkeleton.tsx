import { SkeletonBlock } from '../../../shared/ui';

const NODE_POSITIONS = [
  'left-[42%] top-[14%]',
  'left-[24%] top-[34%]',
  'left-[44%] top-[34%]',
  'left-[64%] top-[34%]',
  'left-[18%] top-[66%]',
  'left-[40%] top-[66%]',
  'left-[62%] top-[66%]',
];

export function TopologySkeleton() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-gray-950">
      <div className="absolute left-3 right-3 top-3 z-10 flex items-center gap-2">
        <div className="rounded-xl border border-gray-700 bg-gray-900/90 px-4 py-2 backdrop-blur">
          <SkeletonBlock className="h-5 w-40 rounded-lg" />
        </div>
        <SkeletonBlock className="h-10 w-10 rounded-xl border border-gray-700 bg-gray-900/90" />
        <div className="ml-auto rounded-xl border border-gray-700 bg-gray-900/90 px-3 py-2 backdrop-blur">
          <div className="flex gap-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <SkeletonBlock key={index} className="h-4 w-14 rounded-md" />
            ))}
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0">
        {NODE_POSITIONS.map((positionClassName, index) => (
          <div key={index} className={`absolute ${positionClassName}`}>
            <div className="rounded-2xl border border-gray-700 bg-gray-900/80 p-4 shadow-lg">
              <SkeletonBlock className="h-5 w-28 rounded-md" />
              <SkeletonBlock className="mt-3 h-3 w-32 rounded-md" />
              <div className="mt-4 space-y-2">
                <SkeletonBlock className="h-10 w-48 rounded-lg" />
                <SkeletonBlock className="h-10 w-48 rounded-lg" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
