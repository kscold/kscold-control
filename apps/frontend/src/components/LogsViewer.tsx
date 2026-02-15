import { useState, useEffect, useRef } from 'react';
import { Terminal, RefreshCw, Download, Filter, Activity } from 'lucide-react';
import { api } from '../lib/api';

type LogType = 'backend' | 'pm2' | 'nginx-access' | 'nginx-error' | 'docker';

interface DockerContainer {
  id: string;
  name: string;
  status: string;
}

export function LogsViewer() {
  const [logType, setLogType] = useState<LogType>('backend');
  const [logs, setLogs] = useState<string[]>([]);
  const [dockerContainers, setDockerContainers] = useState<DockerContainer[]>(
    [],
  );
  const [selectedContainer, setSelectedContainer] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [lineCount, setLineCount] = useState(200);
  const [isLoading, setIsLoading] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadLogs();
    if (logType === 'docker') {
      loadDockerContainers();
    }
  }, [logType, selectedContainer, lineCount]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(loadLogs, 3000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, logType, selectedContainer, lineCount]);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      if (logType === 'pm2') {
        const { data } = await api.get(`/logs/pm2?lines=${lineCount}`);
        const combined = [
          '=== STDOUT ===',
          ...data.out,
          '',
          '=== STDERR ===',
          ...data.error,
        ];
        setLogs(combined);
      } else if (logType === 'docker' && selectedContainer) {
        const { data } = await api.get(
          `/logs?type=docker&lines=${lineCount}&containerId=${selectedContainer}`,
        );
        setLogs(data.logs);
      } else if (logType !== 'docker') {
        const { data } = await api.get(
          `/logs?type=${logType}&lines=${lineCount}`,
        );
        setLogs(data.logs);
      }
    } catch (error) {
      console.error('Failed to load logs:', error);
      setLogs(['Failed to load logs. Check permissions.']);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDockerContainers = async () => {
    try {
      const { data } = await api.get('/logs/docker/containers');
      setDockerContainers(data);
      if (data.length > 0 && !selectedContainer) {
        setSelectedContainer(data[0].id);
      }
    } catch (error) {
      console.error('Failed to load docker containers:', error);
    }
  };

  const downloadLogs = () => {
    const content = logs.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${logType}-${new Date().toISOString()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const filteredLogs = searchTerm
    ? logs.filter((log) => log.toLowerCase().includes(searchTerm.toLowerCase()))
    : logs;

  return (
    <div className="flex flex-col h-full p-4 sm:p-6 bg-gray-900">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
          <Terminal size={28} />
          시스템 로그
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          실시간 시스템 로그 모니터링
        </p>
      </div>

      {/* Controls - 모바일 최적화 */}
      <div className="space-y-3 mb-4">
        {/* 첫 번째 줄: 로그 타입 및 컨테이너 선택 */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <select
            value={logType}
            onChange={(e) => setLogType(e.target.value as LogType)}
            className="flex-1 px-3 py-2 bg-gray-800 text-white text-sm rounded border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="backend">Backend (stdout)</option>
            <option value="pm2">PM2 (stdout + stderr)</option>
            <option value="nginx-access">Nginx Access</option>
            <option value="nginx-error">Nginx Error</option>
            <option value="docker">Docker Container</option>
          </select>

          {logType === 'docker' && (
            <select
              value={selectedContainer}
              onChange={(e) => setSelectedContainer(e.target.value)}
              className="flex-1 px-3 py-2 bg-gray-800 text-white text-sm rounded border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">컨테이너 선택</option>
              {dockerContainers.map((container) => (
                <option key={container.id} value={container.id}>
                  {container.name} ({container.status})
                </option>
              ))}
            </select>
          )}

          <select
            value={lineCount}
            onChange={(e) => setLineCount(parseInt(e.target.value))}
            className="w-full sm:w-32 px-3 py-2 bg-gray-800 text-white text-sm rounded border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="50">50 줄</option>
            <option value="100">100 줄</option>
            <option value="200">200 줄</option>
            <option value="500">500 줄</option>
            <option value="1000">1000 줄</option>
          </select>
        </div>

        {/* 두 번째 줄: 검색 및 액션 버튼 */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <div className="flex-1 relative">
            <Filter
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={16}
            />
            <input
              type="text"
              placeholder="로그 필터링..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-800 text-white text-sm rounded border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={loadLogs}
              disabled={isLoading}
              className="flex-1 sm:flex-none px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <RefreshCw
                size={16}
                className={isLoading ? 'animate-spin' : ''}
              />
              <span className="hidden sm:inline">새로고침</span>
            </button>

            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex-1 sm:flex-none px-3 py-2 text-sm rounded flex items-center justify-center gap-1.5 ${
                autoRefresh
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              title="자동 새로고침"
            >
              <Activity size={16} />
              <span className="hidden sm:inline">자동</span>
            </button>

            <button
              onClick={downloadLogs}
              className="flex-1 sm:flex-none px-3 py-2 bg-gray-700 text-white text-sm rounded hover:bg-gray-600 flex items-center justify-center gap-1.5"
              title="다운로드"
            >
              <Download size={16} />
              <span className="hidden sm:inline">다운로드</span>
            </button>
          </div>
        </div>
      </div>

      {/* Log Output */}
      <div className="flex-1 bg-black rounded-lg p-2 sm:p-4 overflow-auto font-mono text-xs sm:text-sm">
        <div className="text-green-400 break-all sm:break-normal">
          {filteredLogs.length > 0 ? (
            filteredLogs.map((log, index) => (
              <div
                key={index}
                className={`leading-relaxed ${
                  log.includes('ERROR') || log.includes('error')
                    ? 'text-red-400'
                    : log.includes('WARN') || log.includes('warn')
                      ? 'text-yellow-400'
                      : log.includes('===')
                        ? 'text-cyan-400 font-bold'
                        : 'text-green-400'
                }`}
              >
                {log}
              </div>
            ))
          ) : (
            <div className="text-gray-500">로그가 없습니다.</div>
          )}
          <div ref={logsEndRef} />
        </div>
      </div>

      {/* Stats */}
      <div className="mt-3 flex flex-wrap gap-3 sm:gap-4 text-xs sm:text-sm text-gray-400">
        <span>전체: {logs.length}줄</span>
        {searchTerm && <span>필터: {filteredLogs.length}줄</span>}
        <button
          onClick={scrollToBottom}
          className="text-blue-400 hover:text-blue-300 underline"
        >
          맨 아래로 ↓
        </button>
      </div>
    </div>
  );
}
