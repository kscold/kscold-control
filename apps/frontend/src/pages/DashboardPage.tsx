import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Terminal, Container, Cpu, HardDrive, Activity } from 'lucide-react';
import { api } from '../lib/api';

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
  disk: {
    total: number;
    used: number;
    available: number;
    usedPercent: number;
    breakdown: { docker: number; applications: number; other: number };
  };
  platform: string;
  hostname: string;
  uptime: number;
}

interface LiveStats {
  cpu: { usage: number; count: number; model: string };
  memory: { total: number; used: number; free: number; usedPercent: number };
  uptime: number;
}

export function DashboardPage() {
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [liveStats, setLiveStats] = useState<LiveStats | null>(null);
  const navigate = useNavigate();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadContainers = useCallback(async () => {
    try {
      const { data } = await api.get('/docker/containers');
      setContainers(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadSystemInfo = useCallback(async () => {
    try {
      const { data } = await api.get('/system/info');
      setSystemInfo(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadLiveStats = useCallback(async () => {
    try {
      const { data } = await api.get('/system/stats');
      setLiveStats(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadContainers();
    loadSystemInfo();
    loadLiveStats();

    const startPolling = () => {
      if (intervalRef.current) return;
      intervalRef.current = setInterval(() => {
        loadLiveStats();
        loadContainers();
      }, 5000);
    };

    const stopPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadLiveStats();
        startPolling();
      } else {
        stopPolling();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loadContainers, loadSystemInfo, loadLiveStats]);

  const runningCount = containers.filter(
    (c) => c.liveStatus === 'running',
  ).length;

  const formatBytes = (bytes: number) => {
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  };

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const cpuUsage = liveStats?.cpu.usage ?? 0;
  const memUsage = liveStats?.memory.usedPercent ?? 0;

  return (
    <div className="h-full overflow-auto p-4 sm:p-6 bg-gray-950">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-white">Dashboard</h2>
        {liveStats && (
          <span className="text-xs text-gray-500">
            Uptime {formatUptime(liveStats.uptime)}
          </span>
        )}
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <Container size={18} className="text-blue-400 flex-shrink-0" />
            <span className="text-gray-400 text-xs sm:text-sm">Containers</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white">
            {containers.length}
          </p>
          <p className="text-xs text-green-400 mt-1">
            {runningCount} running
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <Cpu size={18} className="text-purple-400 flex-shrink-0" />
            <span className="text-gray-400 text-xs sm:text-sm">CPU</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white">
            {cpuUsage.toFixed(1)}%
          </p>
          <div className="mt-2 w-full bg-gray-700 rounded-full h-2 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                cpuUsage > 80
                  ? 'bg-red-500'
                  : cpuUsage > 50
                    ? 'bg-amber-400'
                    : 'bg-green-400'
              }`}
              style={{ width: `${Math.min(cpuUsage, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {systemInfo ? `${systemInfo.cpu.count} cores` : '...'}
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <Activity size={18} className="text-cyan-400 flex-shrink-0" />
            <span className="text-gray-400 text-xs sm:text-sm">Memory</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white">
            {memUsage.toFixed(1)}%
          </p>
          <div className="mt-2 w-full bg-gray-700 rounded-full h-2 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                memUsage > 80
                  ? 'bg-red-500'
                  : memUsage > 60
                    ? 'bg-amber-400'
                    : 'bg-blue-400'
              }`}
              style={{ width: `${Math.min(memUsage, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {liveStats
              ? `${formatBytes(liveStats.memory.used)} / ${formatBytes(liveStats.memory.total)}`
              : '...'}
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <HardDrive size={18} className="text-amber-400 flex-shrink-0" />
            <span className="text-gray-400 text-xs sm:text-sm">Disk</span>
          </div>
          {systemInfo ? (
            <div>
              <p className="text-lg sm:text-2xl font-bold text-white">
                {formatBytes(systemInfo.disk.used)} /{' '}
                {formatBytes(systemInfo.disk.total)}
              </p>
              <div className="mt-2 w-full bg-gray-700 rounded-full h-2 flex overflow-hidden">
                {systemInfo.disk.breakdown && (
                  <>
                    <div
                      className="bg-blue-400 h-2 transition-all"
                      style={{
                        width: `${(systemInfo.disk.breakdown.docker / systemInfo.disk.total) * 100}%`,
                      }}
                    />
                    <div
                      className="bg-purple-400 h-2 transition-all"
                      style={{
                        width: `${(systemInfo.disk.breakdown.applications / systemInfo.disk.total) * 100}%`,
                      }}
                    />
                    <div
                      className="bg-amber-400 h-2 transition-all"
                      style={{
                        width: `${(systemInfo.disk.breakdown.other / systemInfo.disk.total) * 100}%`,
                      }}
                    />
                  </>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {systemInfo.disk.usedPercent.toFixed(1)}% used
              </p>
              {systemInfo.disk.breakdown && (
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                    <span className="text-gray-400">
                      Docker {formatBytes(systemInfo.disk.breakdown.docker)}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
                    <span className="text-gray-400">
                      Apps {formatBytes(systemInfo.disk.breakdown.applications)}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                    <span className="text-gray-400">
                      Other {formatBytes(systemInfo.disk.breakdown.other)}
                    </span>
                  </span>
                </div>
              )}
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
