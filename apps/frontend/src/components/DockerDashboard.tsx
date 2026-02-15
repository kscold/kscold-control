import { useState, useEffect } from 'react';
import { Play, Square, Trash2, Plus, Activity } from 'lucide-react';
import { useModalStore } from '../stores/modal.store';
import { usePermissions } from '../hooks/usePermissions';
import { useAuthStore } from '../stores/auth.store';
import { api } from '../lib/api';

interface Container {
  id: string;
  name: string;
  image: string;
  status: string;
  ports: Record<string, number>;
  resources: { cpus: number; memory: string };
  createdAt: string;
  liveStatus: string;
  externalAccess?: {
    ssh?: string;
    http?: string;
    domain: string;
  };
}

export function DockerDashboard() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [containerConfig, setContainerConfig] = useState({
    name: '',
    image: 'ubuntu:22.04',
    cpus: 2,
    memory: '4g',
    sshPort: 2222,
    httpPort: 8001,
  });
  const { showAlert, showConfirm } = useModalStore();
  const { hasPermission, checkPermission } = usePermissions();
  const { user } = useAuthStore();

  useEffect(() => {
    loadContainers();
    const interval = setInterval(loadContainers, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadContainers = async () => {
    try {
      const { data } = await api.get('/docker/containers/all');
      setContainers(data);
    } catch (error) {
      console.error('Failed to load containers:', error);
    }
  };

  const handleStart = async (id: string) => {
    try {
      await api.post(`/docker/containers/${id}/start`);
      await loadContainers();
    } catch (error) {
      console.error('Failed to start container:', error);
    }
  };

  const handleStop = async (id: string) => {
    try {
      await api.post(`/docker/containers/${id}/stop`);
      await loadContainers();
    } catch (error) {
      console.error('Failed to stop container:', error);
    }
  };

  const handleDelete = async (id: string) => {
    showConfirm(
      '정말 삭제하시겠습니까?',
      async () => {
        try {
          await api.delete(`/docker/containers/${id}`);
          await loadContainers();
        } catch (error) {
          console.error('Failed to delete container:', error);
        }
      },
      '컨테이너 삭제',
    );
  };

  const handleOpenCreateModal = () => {
    setContainerConfig({
      name: `ubuntu-${Date.now()}`,
      image: 'ubuntu:22.04',
      cpus: 2,
      memory: '4g',
      sshPort: 2222 + containers.length,
      httpPort: 8001 + containers.length,
    });
    setShowCreateModal(true);
  };

  const handleCreate = async () => {
    if (!containerConfig.name) {
      showAlert('컨테이너 이름을 입력하세요');
      return;
    }
    if (!user?.id) {
      showAlert('사용자 정보를 찾을 수 없습니다');
      return;
    }
    setIsCreating(true);
    try {
      await api.post('/docker/containers', {
        userId: user.id,
        name: containerConfig.name,
        image: containerConfig.image,
        ports: {
          '22': containerConfig.sshPort,
          '80': containerConfig.httpPort,
        },
        resources: {
          cpus: containerConfig.cpus,
          memory: containerConfig.memory,
        },
        environment: { TZ: 'Asia/Seoul' },
      });
      await loadContainers();
      setShowCreateModal(false);
    } catch (error: any) {
      console.error('Failed to create container:', error);
      showAlert(error.response?.data?.message || '컨테이너 생성 실패');
    } finally {
      setIsCreating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-green-500';
      case 'exited':
      case 'stopped':
        return 'bg-gray-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-yellow-500';
    }
  };

  return (
    <div className="flex flex-col h-full p-4 sm:p-6 bg-gray-900 overflow-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-white">
          Docker 컨테이너
        </h1>
        <button
          onClick={() =>
            checkPermission('docker:create', handleOpenCreateModal)
          }
          disabled={isCreating}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 w-full sm:w-auto"
        >
          <Plus size={20} />
          컨테이너 생성
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {containers.map((container) => (
          <div
            key={container.id}
            className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-white truncate">
                  {container.name}
                </h3>
                <p className="text-sm text-gray-400 truncate">
                  {container.image}
                </p>
              </div>
              <div
                className={`flex-shrink-0 w-3 h-3 rounded-full ${getStatusColor(
                  container.liveStatus,
                )} ml-2`}
                title={container.liveStatus}
              />
            </div>

            <div className="space-y-2 mb-4 text-xs sm:text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col">
                  <span className="text-gray-400 text-xs">CPU</span>
                  <span className="font-mono text-gray-300">
                    {container.resources.cpus > 0
                      ? `${container.resources.cpus} cores`
                      : '무제한'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-gray-400 text-xs">Memory</span>
                  <span className="font-mono text-gray-300">
                    {container.resources.memory !== '0'
                      ? container.resources.memory
                      : '무제한'}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-gray-400 font-medium text-xs">Ports</span>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(container.ports).map(
                    ([internal, external]) => (
                      <span
                        key={internal}
                        className="px-1.5 py-0.5 bg-gray-900 text-gray-300 text-xs font-mono rounded"
                      >
                        {external}→{internal}
                      </span>
                    ),
                  )}
                </div>
              </div>
              {container.externalAccess && (
                <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t border-gray-700">
                  <span className="text-blue-400 font-medium text-xs">
                    외부 접속
                  </span>
                  {container.externalAccess.ssh && (
                    <div className="text-xs">
                      <span className="text-gray-400">SSH:</span>
                      <code className="ml-1 text-green-400 bg-gray-900 px-1.5 py-0.5 rounded text-xs break-all">
                        {container.externalAccess.ssh}
                      </code>
                    </div>
                  )}
                  {container.externalAccess.http && (
                    <div className="text-xs">
                      <span className="text-gray-400">HTTP:</span>
                      <a
                        href={container.externalAccess.http}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-1 text-blue-400 hover:text-blue-300 underline break-all"
                      >
                        {container.externalAccess.http}
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {container.liveStatus === 'running' ? (
                <button
                  onClick={() =>
                    checkPermission('docker:update', () =>
                      handleStop(container.id),
                    )
                  }
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
                >
                  <Square size={16} />
                  <span className="hidden sm:inline">중지</span>
                </button>
              ) : (
                <button
                  onClick={() =>
                    checkPermission('docker:update', () =>
                      handleStart(container.id),
                    )
                  }
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                >
                  <Play size={16} />
                  <span className="hidden sm:inline">시작</span>
                </button>
              )}
              <button
                onClick={() =>
                  checkPermission('docker:delete', () =>
                    handleDelete(container.id),
                  )
                }
                className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                title="삭제"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {containers.length === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 text-gray-500 py-12">
          <Activity size={48} className="mb-4" />
          <p className="text-center px-4">
            아직 컨테이너가 없습니다. Ubuntu를 생성하여 시작하세요!
          </p>
        </div>
      )}

      {/* 컨테이너 생성 모달 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-gray-800 rounded-lg p-4 sm:p-6 max-w-md w-full border border-gray-700 my-4">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-4">
              Ubuntu 컨테이너 생성
            </h2>

            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">
                  컨테이너 이름
                </label>
                <input
                  type="text"
                  value={containerConfig.name}
                  onChange={(e) =>
                    setContainerConfig({
                      ...containerConfig,
                      name: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ubuntu-1"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">
                  이미지
                </label>
                <select
                  value={containerConfig.image}
                  onChange={(e) =>
                    setContainerConfig({
                      ...containerConfig,
                      image: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ubuntu:22.04">Ubuntu 22.04 LTS</option>
                  <option value="ubuntu:20.04">Ubuntu 20.04 LTS</option>
                  <option value="ubuntu:24.04">Ubuntu 24.04 LTS</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">
                    CPU (cores)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="8"
                    value={containerConfig.cpus}
                    onChange={(e) =>
                      setContainerConfig({
                        ...containerConfig,
                        cpus: parseInt(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">
                    메모리
                  </label>
                  <select
                    value={containerConfig.memory}
                    onChange={(e) =>
                      setContainerConfig({
                        ...containerConfig,
                        memory: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="1g">1GB</option>
                    <option value="2g">2GB</option>
                    <option value="4g">4GB</option>
                    <option value="8g">8GB</option>
                    <option value="16g">16GB</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">
                    SSH 포트
                  </label>
                  <input
                    type="number"
                    min="2222"
                    max="9999"
                    value={containerConfig.sshPort}
                    onChange={(e) =>
                      setContainerConfig({
                        ...containerConfig,
                        sshPort: parseInt(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">
                    HTTP 포트
                  </label>
                  <input
                    type="number"
                    min="8001"
                    max="9999"
                    value={containerConfig.httpPort}
                    onChange={(e) =>
                      setContainerConfig({
                        ...containerConfig,
                        httpPort: parseInt(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                disabled={isCreating}
                className="flex-1 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleCreate}
                disabled={isCreating}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isCreating ? '생성 중...' : '생성'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
