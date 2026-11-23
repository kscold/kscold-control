import { useState } from 'react';
import { formatBytes } from '@/shared/lib';
import { usePermissions } from '@/shared/model';
import { PERMISSIONS } from '@/shared/config/permissions';
import {
  useContainers,
  useContainerActions,
  useCreateContainer,
  useDockerCleanupCandidates,
} from '../model';
import { ContainerList } from './ContainerList';
import { CreateContainerModal } from './CreateContainerModal';
import { DockerCleanupSection } from './DockerCleanupSection';
import { DockerContainerFilters } from './DockerContainerFilters';
import { DockerDashboardHeader } from './DockerDashboardHeader';
import { DockerDashboardSkeleton } from './DockerDashboardSkeleton';

type FilterType = 'all' | 'managed' | 'external';

/**
 * Docker 관리 화면의 메인 대시보드입니다.
 * 컨테이너 목록과 안전 정리 후보를 함께 보여줍니다.
 */
export function DockerDashboard() {
  const { containers, loading, error, reload } = useContainers();
  const {
    candidates,
    loading: cleanupLoading,
    error: cleanupError,
    reload: reloadCleanup,
  } = useDockerCleanupCandidates();
  const { startContainer, stopContainer, deleteContainer, importContainer } =
    useContainerActions(reload);
  const {
    showModal,
    config,
    isCreating,
    isPreparingTemplate,
    templateWarning,
    openModal,
    closeModal,
    updateConfig,
    createContainer,
  } = useCreateContainer(reload);
  const { checkPermission } = usePermissions();
  const [filter, setFilter] = useState<FilterType>('all');

  const filteredContainers = containers.filter((c) => {
    if (filter === 'all') return true;
    if (filter === 'managed') return c.isManaged;
    if (filter === 'external') return !c.isManaged;
    return true;
  });

  const stats = {
    total: containers.length,
    managed: containers.filter((c) => c.isManaged).length,
    external: containers.filter((c) => !c.isManaged).length,
  };

  // 정리 후보 계산(docker system df -v)은 몇 초 걸리므로 컨테이너 목록을 기다리게 하지 않는다.
  const showSkeleton = loading && containers.length === 0;

  if (showSkeleton) {
    return <DockerDashboardSkeleton />;
  }

  return (
    <div className="flex flex-col h-full p-4 sm:p-6 bg-gray-900 overflow-auto">
      <DockerDashboardHeader
        isCreating={isCreating}
        onCreate={() => checkPermission(PERMISSIONS.DOCKER_CREATE, openModal)}
      />

      {error ? (
        <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      <DockerContainerFilters
        filter={filter}
        stats={stats}
        onChange={setFilter}
      />

      <ContainerList
        containers={filteredContainers}
        onStart={startContainer}
        onStop={stopContainer}
        onDelete={deleteContainer}
        onImport={importContainer}
      />

      {/* 정리는 가끔 하는 일이라 컨테이너 목록 아래에 접어 둔다. */}
      <details className="group mt-8 rounded-2xl border border-gray-800 bg-gray-950/40">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm text-gray-300 hover:text-white">
          <span className="font-medium">디스크 정리 후보</span>
          <span className="text-xs text-gray-500">
            {cleanupLoading && !candidates
              ? '계산 중…'
              : candidates
                ? `예상 절감 ${formatBytes(candidates.summary.reclaimableBytes)}`
                : '열어서 확인'}
          </span>
        </summary>
        <div className="border-t border-gray-800 p-4">
          <DockerCleanupSection
            onRefreshContainers={reload}
            candidates={candidates}
            loading={cleanupLoading}
            error={cleanupError}
            onReload={() => {
              void reloadCleanup();
            }}
          />
        </div>
      </details>

      <CreateContainerModal
        show={showModal}
        config={config}
        isCreating={isCreating}
        isPreparing={isPreparingTemplate}
        templateWarning={templateWarning}
        onClose={closeModal}
        onConfigChange={updateConfig}
        onCreate={createContainer}
      />
    </div>
  );
}
