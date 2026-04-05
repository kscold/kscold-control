interface SkeletonBlockProps {
  className?: string;
}

export function SkeletonBlock({
  className = 'h-4 w-full rounded-md',
}: SkeletonBlockProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse bg-gray-800/85 ${className}`}
    />
  );
}
