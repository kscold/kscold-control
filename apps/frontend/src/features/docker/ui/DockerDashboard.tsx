import { useState } from 'react';
import { usePermissions } from '@/shared/lib/use-permissions';
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

  const showSkeleton =
    (loading && containers.length === 0) || (cleanupLoading && !candidates);

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

      <DockerCleanupSection
        onRefreshContainers={reload}
        candidates={candidates}
        loading={cleanupLoading}
        error={cleanupError}
        onReload={() => {
          void reloadCleanup();
        }}
      />

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
