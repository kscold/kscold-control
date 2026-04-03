import { Plus } from 'lucide-react';

interface DockerDashboardHeaderProps {
  isCreating: boolean;
  onCreate: () => void;
}

export function DockerDashboardHeader({
  isCreating,
  onCreate,
}: DockerDashboardHeaderProps) {
  return (
    <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <h1 className="text-xl font-bold text-white sm:text-2xl">
        Docker 컨테이너
      </h1>
      <button
        onClick={onCreate}
        disabled={isCreating}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:opacity-50 sm:w-auto"
      >
        <Plus size={20} />
        인스턴스 생성
      </button>
    </div>
  );
}
