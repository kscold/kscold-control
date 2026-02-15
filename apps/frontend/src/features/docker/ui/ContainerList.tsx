import { Activity } from 'lucide-react';
import { ContainerCard } from './ContainerCard';
import type { Container } from '../../../types/domain.types';

interface ContainerListProps {
  containers: Container[];
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onDelete: (id: string) => void;
}

/**
 * ContainerList Component
 * Displays grid of container cards or empty state
 */
export function ContainerList({
  containers,
  onStart,
  onStop,
  onDelete,
}: ContainerListProps) {
  if (containers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-gray-500 py-12">
        <Activity size={48} className="mb-4" />
        <p className="text-center px-4">
          아직 컨테이너가 없습니다. Ubuntu를 생성하여 시작하세요!
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {containers.map((container) => (
        <ContainerCard
          key={container.id}
          container={container}
          onStart={onStart}
          onStop={onStop}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
