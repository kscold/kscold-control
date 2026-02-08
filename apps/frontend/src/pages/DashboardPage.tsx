import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Terminal, Container, Cpu, HardDrive } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../stores/auth.store';

const API_URL = import.meta.env.VITE_API_URL || '';

interface ContainerInfo {
  id: string;
  name: string;
  status: string;
  liveStatus: string;
  resources: { cpus: number; memory: string };
}

interface SystemInfo {
  cpu: { count: number; model: string };
  memory: { total: number; used: number; free: number; usedPercent: number };
  disk: { total: number; used: number; available: number; usedPercent: number };
  platform: string;
  hostname: string;
  uptime: number;
}

export function DashboardPage() {
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const { token } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    loadContainers();
    loadSystemInfo();
  }, []);

  const loadContainers = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/docker/containers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setContainers(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadSystemInfo = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/system/info`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSystemInfo(data);
    } catch (e) {
      console.error(e);
    }
  };

  const runningCount = containers.filter(
    (c) => c.liveStatus === 'running',
  ).length;

  const formatBytes = (bytes: number) => {
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-white mb-6">Dashboard</h2>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <Container size={20} className="text-blue-400" />
            <span className="text-gray-400 text-sm">Total Containers</span>
          </div>
          <p className="text-3xl font-bold text-white">{containers.length}</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-gray-400 text-sm">Running</span>
          </div>
          <p className="text-3xl font-bold text-green-400">{runningCount}</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <Cpu size={20} className="text-purple-400" />
            <span className="text-gray-400 text-sm">Total CPUs</span>
          </div>
          <p className="text-3xl font-bold text-white">
            {systemInfo ? `${systemInfo.cpu.count} cores` : 'Loading...'}
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <HardDrive size={20} className="text-amber-400" />
            <span className="text-gray-400 text-sm">Host Disk</span>
          </div>
          {systemInfo ? (
            <div>
              <p className="text-3xl font-bold text-white">
                {formatBytes(systemInfo.disk.used)} /{' '}
                {formatBytes(systemInfo.disk.total)}
              </p>
              <div className="mt-2 w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-amber-400 h-2 rounded-full transition-all"
                  style={{ width: `${systemInfo.disk.usedPercent}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {systemInfo.disk.usedPercent.toFixed(1)}% used
              </p>
            </div>
          ) : (
            <p className="text-3xl font-bold text-white">Loading...</p>
          )}
        </div>
      </div>

      {/* 빠른 액션 */}
      <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => navigate('/terminal')}
          className="flex items-center gap-4 p-5 bg-gray-900 border border-gray-800 rounded-xl hover:border-blue-600 transition"
        >
          <Terminal size={32} className="text-blue-400" />
          <div className="text-left">
            <p className="text-white font-semibold">Terminal</p>
            <p className="text-gray-500 text-sm">Mac Mini 터미널 접속</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/docker')}
          className="flex items-center gap-4 p-5 bg-gray-900 border border-gray-800 rounded-xl hover:border-blue-600 transition"
        >
          <Container size={32} className="text-green-400" />
          <div className="text-left">
            <p className="text-white font-semibold">Docker Manager</p>
            <p className="text-gray-500 text-sm">
              Create and manage containers
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}
