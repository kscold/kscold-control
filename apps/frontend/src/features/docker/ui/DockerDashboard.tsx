import { useState } from 'react';
import { usePermissions } from '../../../hooks/usePermissions';
import { PERMISSIONS } from '../../../constants/permissions';
import {
  useContainers,
  useContainerActions,
  useCreateContainer,
} from '../hooks';
import {
  ContainerList,
  CreateContainerModal,
  DockerCleanupSection,
  DockerContainerFilters,
  DockerDashboardHeader,
  DockerDashboardSkeleton,
} from './';

type FilterType = 'all' | 'managed' | 'external';

/**
 * Docker 관리 화면의 메인 대시보드입니다.
 * 컨테이너 목록과 안전 정리 후보를 함께 보여줍니다.
 */
export function DockerDashboard() {
  const { containers, loading, error, reload } = useContainers();
  const { startContainer, stopContainer, deleteContainer, importContainer } =
    useContainerActions(reload);
  const {
    showModal,
    config,
    isCreating,
    openModal,
    closeModal,
    updateConfig,
    createContainer,
  } = useCreateContainer(containers.length, reload);
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

      <DockerCleanupSection onRefreshContainers={reload} />

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
        onClose={closeModal}
        onConfigChange={updateConfig}
        onCreate={createContainer}
      />
    </div>
  );
}
