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
    <div className="h-full overflow-auto p-4 sm:p-6 bg-gray-950">
      <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">
        Dashboard
      </h2>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <Container size={18} className="text-blue-400 flex-shrink-0" />
            <span className="text-gray-400 text-xs sm:text-sm">
              Total Containers
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white">
            {containers.length}
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
            <span className="text-gray-400 text-xs sm:text-sm">Running</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-green-400">
            {runningCount}
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <Cpu size={18} className="text-purple-400 flex-shrink-0" />
            <span className="text-gray-400 text-xs sm:text-sm">Total CPUs</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white">
            {systemInfo ? `${systemInfo.cpu.count} cores` : '...'}
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <HardDrive size={18} className="text-amber-400 flex-shrink-0" />
            <span className="text-gray-400 text-xs sm:text-sm">Host Disk</span>
          </div>
          {systemInfo ? (
            <div>
              <p className="text-lg sm:text-2xl font-bold text-white">
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
            <p className="text-2xl sm:text-3xl font-bold text-white">...</p>
          )}
        </div>
      </div>

      {/* 빠른 액션 */}
      <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">
        Quick Actions
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pb-6">
        <button
          onClick={() => navigate('/terminal')}
          className="flex items-center gap-3 sm:gap-4 p-4 sm:p-5 bg-gray-900 border border-gray-800 rounded-xl hover:border-blue-600 transition active:scale-95"
        >
          <Terminal size={28} className="text-blue-400 flex-shrink-0" />
          <div className="text-left min-w-0">
            <p className="text-white font-semibold text-sm sm:text-base">
              Terminal
            </p>
            <p className="text-gray-500 text-xs sm:text-sm truncate">
              Mac Mini 터미널 접속
            </p>
          </div>
        </button>

        <button
          onClick={() => navigate('/docker')}
          className="flex items-center gap-3 sm:gap-4 p-4 sm:p-5 bg-gray-900 border border-gray-800 rounded-xl hover:border-blue-600 transition active:scale-95"
        >
          <Container size={28} className="text-green-400 flex-shrink-0" />
          <div className="text-left min-w-0">
            <p className="text-white font-semibold text-sm sm:text-base">
              Docker Manager
            </p>
            <p className="text-gray-500 text-xs sm:text-sm truncate">
              Create and manage containers
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}
