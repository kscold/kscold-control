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
} from './';

type FilterType = 'all' | 'managed' | 'external';

/**
 * Docker 관리 화면의 메인 대시보드입니다.
 * 컨테이너 목록과 안전 정리 후보를 함께 보여줍니다.
 */
export function DockerDashboard() {
  const { containers, loading, reload } = useContainers();
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4 sm:p-6 bg-gray-900 overflow-auto">
      <DockerDashboardHeader
        isCreating={isCreating}
        onCreate={() => checkPermission(PERMISSIONS.DOCKER_CREATE, openModal)}
      />

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
