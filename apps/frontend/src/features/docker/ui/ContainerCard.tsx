import { Play, Square, Trash2, Download, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../../../hooks/usePermissions';
import type { Container } from '../../../types/domain.types';

interface ContainerCardProps {
  container: Container;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onDelete: (id: string) => void;
  onImport?: (dockerId: string) => void;
}

/**
 * ContainerCard Component
 * Displays individual container information and actions
 */
export function ContainerCard({
  container,
  onStart,
  onStop,
  onDelete,
  onImport,
}: ContainerCardProps) {
  const { checkPermission } = usePermissions();
  const navigate = useNavigate();

  const handleConnectProxy = () => {
    // Find the first internal port to use as upstream
    const ports = Object.keys(container.ports);
    const mainPort = ports.find((p) => p !== '22') || ports[0] || '8080';
    const upstream = `http://${container.name}:${mainPort}`;
    navigate(
      `/nginx?upstream=${encodeURIComponent(upstream)}&name=${encodeURIComponent(container.name)}`,
    );
  };

  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
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
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-semibold text-white truncate">
              {container.name}
            </h3>
            {container.isManaged ? (
              <span className="px-2 py-0.5 bg-green-600 text-white text-xs rounded-full flex-shrink-0">
                Managed
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-amber-600 text-white text-xs rounded-full flex-shrink-0">
                External
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400 truncate">{container.image}</p>
        </div>
        <div
          className={`flex-shrink-0 w-3 h-3 rounded-full ${getStatusColor(container.liveStatus)} ml-2`}
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
            {Object.entries(container.ports).map(([internal, external]) => (
              <span
                key={internal}
                className="px-1.5 py-0.5 bg-gray-900 text-gray-300 text-xs font-mono rounded"
              >
                {external}→{internal}
              </span>
            ))}
          </div>
        </div>
        {container.externalAccess && (
          <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t border-gray-700">
            <span className="text-blue-400 font-medium text-xs">외부 접속</span>
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

      {!container.isManaged && (
        <div className="mb-3 p-2 bg-amber-900/30 border border-amber-600/50 rounded text-xs text-amber-200 flex items-center justify-between">
          <span>외부 컨테이너 - Import하여 관리 가능</span>
          {onImport && (
            <button
              onClick={() =>
                checkPermission('docker:create', () =>
                  onImport(container.dockerId),
                )
              }
              className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
            >
              <Download size={12} />
              Import
            </button>
          )}
        </div>
      )}

      <div className="flex gap-2">
        {container.liveStatus === 'running' ? (
          <button
            onClick={() =>
              checkPermission('docker:update', () => onStop(container.id))
            }
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
            title="중지"
          >
            <Square size={16} />
            <span className="hidden sm:inline">중지</span>
          </button>
        ) : (
          <button
            onClick={() =>
              checkPermission('docker:update', () => onStart(container.id))
            }
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            title="시작"
          >
            <Play size={16} />
            <span className="hidden sm:inline">시작</span>
          </button>
        )}
        <button
          onClick={handleConnectProxy}
          className="px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
          title="프록시 연결"
        >
          <Globe size={16} />
        </button>
        <button
          onClick={() =>
            checkPermission('docker:delete', () => onDelete(container.id))
          }
          className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          title="삭제"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
