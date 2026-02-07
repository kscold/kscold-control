import { useState, useEffect } from 'react';
import axios from 'axios';
import { Play, Square, Trash2, Plus, Activity } from 'lucide-react';
import { useAuthStore } from '../stores/auth.store';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

interface Container {
  id: string;
  name: string;
  image: string;
  status: string;
  ports: Record<string, number>;
  resources: { cpus: number; memory: string };
  createdAt: string;
  liveStatus: string;
}

export function DockerDashboard() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const { token } = useAuthStore();

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    loadContainers();
    const interval = setInterval(loadContainers, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadContainers = async () => {
    try {
      const { data } = await axios.get(
        `${API_URL}/api/docker/containers`,
        authHeaders,
      );
      setContainers(data);
    } catch (error) {
      console.error('Failed to load containers:', error);
    }
  };

  const handleStart = async (id: string) => {
    try {
      await axios.post(
        `${API_URL}/api/docker/containers/${id}/start`,
        {},
        authHeaders,
      );
      await loadContainers();
    } catch (error) {
      console.error('Failed to start container:', error);
    }
  };

  const handleStop = async (id: string) => {
    try {
      await axios.post(
        `${API_URL}/api/docker/containers/${id}/stop`,
        {},
        authHeaders,
      );
      await loadContainers();
    } catch (error) {
      console.error('Failed to stop container:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      await axios.delete(`${API_URL}/api/docker/containers/${id}`, authHeaders);
      await loadContainers();
    } catch (error) {
      console.error('Failed to delete container:', error);
    }
  };

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      await axios.post(
        `${API_URL}/api/docker/containers`,
        {
          name: `ubuntu-${Date.now()}`,
          image: 'ubuntu:22.04',
          ports: {
            '22': 2221 + containers.length,
            '80': 8001 + containers.length,
          },
          resources: { cpus: 2, memory: '4g' },
          environment: { TZ: 'Asia/Seoul' },
        },
        authHeaders,
      );
      await loadContainers();
    } catch (error) {
      console.error('Failed to create container:', error);
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
    <div className="flex flex-col h-full p-6 bg-gray-900">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Docker Containers</h1>
        <button
          onClick={handleCreate}
          disabled={isCreating}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Plus size={20} />
          {isCreating ? 'Creating...' : 'Create Ubuntu'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {containers.map((container) => (
          <div
            key={container.id}
            className="bg-gray-800 rounded-lg p-4 border border-gray-700"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {container.name}
                </h3>
                <p className="text-sm text-gray-400">{container.image}</p>
              </div>
              <div
                className={`w-3 h-3 rounded-full ${getStatusColor(
                  container.liveStatus,
                )}`}
                title={container.liveStatus}
              />
            </div>

            <div className="space-y-2 mb-4 text-sm">
              <div className="flex justify-between text-gray-300">
                <span>CPU:</span>
                <span>{container.resources.cpus} cores</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>Memory:</span>
                <span>{container.resources.memory}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-gray-400">Ports:</span>
                {Object.entries(container.ports).map(([internal, external]) => (
                  <div key={internal} className="text-gray-300 text-xs ml-2">
                    {external} → {internal}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              {container.liveStatus === 'running' ? (
                <button
                  onClick={() => handleStop(container.id)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
                >
                  <Square size={16} />
                  Stop
                </button>
              ) : (
                <button
                  onClick={() => handleStart(container.id)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  <Play size={16} />
                  Start
                </button>
              )}
              <button
                onClick={() => handleDelete(container.id)}
                className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {containers.length === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 text-gray-500">
          <Activity size={48} className="mb-4" />
          <p>No containers yet. Create one to get started!</p>
        </div>
      )}
    </div>
  );
}
