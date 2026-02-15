import { useState } from 'react';
import { Plus, Filter } from 'lucide-react';
import { usePermissions } from '../../../hooks/usePermissions';
import {
  useContainers,
  useContainerActions,
  useCreateContainer,
} from '../hooks';
import { ContainerList, CreateContainerModal } from './';

type FilterType = 'all' | 'managed' | 'external';

/**
 * DockerDashboard Component
 * Main container management dashboard
 * Refactored with FSD architecture
 */
export function DockerDashboard() {
  const { containers, loading, reload } = useContainers();
  const { startContainer, stopContainer, deleteContainer } =
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-white">
          Docker 컨테이너
        </h1>
        <button
          onClick={() => checkPermission('docker:create', openModal)}
          disabled={isCreating}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 w-full sm:w-auto"
        >
          <Plus size={20} />
          컨테이너 생성
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto">
        <Filter size={18} className="text-gray-400 flex-shrink-0" />
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          All ({stats.total})
        </button>
        <button
          onClick={() => setFilter('managed')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
            filter === 'managed'
              ? 'bg-green-600 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          Managed ({stats.managed})
        </button>
        <button
          onClick={() => setFilter('external')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
            filter === 'external'
              ? 'bg-amber-600 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          External ({stats.external})
        </button>
      </div>

      <ContainerList
        containers={filteredContainers}
        onStart={startContainer}
        onStop={stopContainer}
        onDelete={deleteContainer}
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
