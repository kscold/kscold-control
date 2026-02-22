interface ContainerConfig {
  name: string;
  image: string;
  cpus: number;
  memory: string;
  sshPort: number;
  httpPort: number;
}

interface CreateContainerModalProps {
  show: boolean;
  config: ContainerConfig;
  isCreating: boolean;
  onClose: () => void;
  onConfigChange: (updates: Partial<ContainerConfig>) => void;
  onCreate: () => void;
}

/**
 * CreateContainerModal Component
 * Modal for creating new Docker instances via compose
 */
export function CreateContainerModal({
  show,
  config,
  isCreating,
  onClose,
  onConfigChange,
  onCreate,
}: CreateContainerModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-gray-800 rounded-lg p-4 sm:p-6 max-w-md w-full border border-gray-700 my-4">
        <h2 className="text-lg sm:text-xl font-bold text-white mb-4">
          인스턴스 생성
        </h2>
        <p className="text-xs text-gray-400 mb-4">
          docker-compose.yml에 서비스가 추가되고 자동으로 시작됩니다.
        </p>

        <div className="space-y-3 sm:space-y-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">
              인스턴스 이름
            </label>
            <input
              type="text"
              value={config.name}
              onChange={(e) => onConfigChange({ name: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="ubuntu-myproject"
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">
              이미지
            </label>
            <select
              value={config.image}
              onChange={(e) => onConfigChange({ image: e.target.value })}
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
                value={config.cpus}
                onChange={(e) =>
                  onConfigChange({ cpus: parseInt(e.target.value) })
                }
                className="w-full px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">
                메모리
              </label>
              <select
                value={config.memory}
                onChange={(e) => onConfigChange({ memory: e.target.value })}
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
                value={config.sshPort}
                onChange={(e) =>
                  onConfigChange({ sshPort: parseInt(e.target.value) })
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
                value={config.httpPort}
                onChange={(e) =>
                  onConfigChange({ httpPort: parseInt(e.target.value) })
                }
                className="w-full px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={isCreating}
            className="flex-1 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={onCreate}
            disabled={isCreating}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isCreating ? '생성 중...' : '생성'}
          </button>
        </div>
      </div>
    </div>
  );
}
