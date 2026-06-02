import { useState, useEffect, useRef, useMemo } from 'react';
import { API_URL, api } from '../../../lib/api';
import { useAuthStore } from '../../../shared/model/auth.store';
import type {
  DockerLogArchiveSource,
  DockerLogFilter,
  DockerLogSince,
  LogLineCount,
  LogType,
} from '../lib/logs.types';

interface UseLogsOptions {
  selectedContainer: string;
  selectedContainerName: string;
  loadDockerContainers: () => Promise<void>;
}

type StreamStatus =
  | 'idle'
  | 'connecting'
  | 'live'
  | 'reconnecting'
  | 'ended'
  | 'error';

const DEFAULT_LINE_COUNT = 200;
const STREAM_CATCHUP_LINE_COUNT = 500;
const DOCKER_TAIL_STEPS: LogLineCount[] = [200, 500, 1000, 5000, 10000, 'all'];
const LIVE_SOURCE_ID = 'live';
const STREAM_RECONNECT_MAX_ATTEMPTS = 10;

function capStreamLines(lines: string[], lineCount: LogLineCount) {
  const maxLines =
    typeof lineCount === 'number' ? Math.max(lineCount, 200) : 2000;
  return lines.slice(-maxLines);
}

function formatDateTimeLocal(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function toIsoOrNull(value: string) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function parseLogTimestamp(line: string) {
  const token = line.trim().split(/\s+/, 1)[0];
  const parsed = Date.parse(token);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function appendUniqueLines(
  current: string[],
  incoming: string[],
  lineCount: LogLineCount,
) {
  if (incoming.length === 0) {
    return current;
  }

  const recentWindow = current.slice(-2000);
  const recent = new Set(recentWindow);
  const merged = [...current];

  incoming.forEach((line) => {
    if (!line.trim()) {
      return;
    }

    if (recent.has(line)) {
      return;
    }

    merged.push(line);
    recent.add(line);
  });

  return capStreamLines(merged, lineCount);
}

export function useLogs({
  selectedContainer,
  selectedContainerName,
  loadDockerContainers,
}: UseLogsOptions) {
  const [logType, setLogType] = useState<LogType>('backend');
  const [logs, setLogs] = useState<string[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [lineCount, setLineCount] = useState<LogLineCount>(DEFAULT_LINE_COUNT);
  const [dockerTimestamps, setDockerTimestamps] = useState(true);
  const [dockerSince, setDockerSince] = useState<DockerLogSince>('none');
  const [dockerStartAt, setDockerStartAt] = useState('');
  const [dockerEndAt, setDockerEndAt] = useState('');
  const [dockerFilter, setDockerFilter] = useState<DockerLogFilter>('all');
  const [archiveSources, setArchiveSources] = useState<DockerLogArchiveSource[]>(
    [],
  );
  const [selectedSourceId, setSelectedSourceId] = useState<string>(LIVE_SOURCE_ID);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>('idle');
  const [streamError, setStreamError] = useState<string | null>(null);
  const [streamReconnectAttempt, setStreamReconnectAttempt] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isArchiveLoading, setIsArchiveLoading] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const isNginxContainer = selectedContainerName === 'kscold-nginx';
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSeenAtRef = useRef<string | null>(null);
  const selectedArchiveSource =
    archiveSources.find((source) => source.id === selectedSourceId) ?? null;
  const isArchiveMode =
    logType === 'docker' && selectedSourceId !== LIVE_SOURCE_ID;

  const effectiveLineCount =
    typeof lineCount === 'number'
      ? lineCount
      : logType === 'docker'
        ? 'all'
        : 1000;

  const dockerWindow = useMemo(() => {
    if (dockerSince === 'custom') {
      return {
        since: toIsoOrNull(dockerStartAt),
        until: toIsoOrNull(dockerEndAt),
      };
    }

    return {
      since: dockerSince === 'none' ? null : dockerSince,
      until: null,
    };
  }, [dockerEndAt, dockerSince, dockerStartAt]);

  const canUseLiveStream =
    logType === 'docker' &&
    Boolean(selectedContainer) &&
    selectedSourceId === LIVE_SOURCE_ID &&
    dockerSince !== 'custom' &&
    !dockerWindow.until;

  const loadArchiveSources = async () => {
    if (!selectedContainer) {
      setArchiveSources([]);
      return;
    }

    setIsArchiveLoading(true);
    try {
      const { data } = await api.get(
        `/logs/docker/archive/sources?containerId=${selectedContainer}`,
      );
      const items = (data.items ?? []) as DockerLogArchiveSource[];
      setArchiveSources(items);

      if (
        selectedSourceId !== LIVE_SOURCE_ID &&
        !items.some((source) => source.id === selectedSourceId)
      ) {
        setSelectedSourceId(LIVE_SOURCE_ID);
      }
    } catch (error) {
      console.error('Failed to load archive sources:', error);
      setArchiveSources([]);
    } finally {
      setIsArchiveLoading(false);
    }
  };

  const buildDockerParams = (
    overrides?: Partial<{
      lines: LogLineCount;
      since: string | null;
      until: string | null;
      sourceId: string;
    }>,
  ) => {
    const params = new URLSearchParams({
      containerId: selectedContainer,
      containerName: selectedContainerName,
      lines: String(overrides?.lines ?? effectiveLineCount),
      timestamps: String(dockerTimestamps),
    });

    const since = overrides?.since ?? dockerWindow.since;
    const until = overrides?.until ?? dockerWindow.until;

    if (since) {
      params.set('since', since);
    }

    if (until) {
      params.set('until', until);
    }

    if (dockerFilter !== 'all') {
      params.set('filter', dockerFilter);
    }

    if ((overrides?.sourceId ?? selectedSourceId) !== LIVE_SOURCE_ID) {
      params.set('sourceId', overrides?.sourceId ?? selectedSourceId);
    }

    return params;
  };

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      if (logType === 'pm2') {
        const { data } = await api.get(`/logs/pm2?lines=${effectiveLineCount}`);
        const combined = [
          '=== STDOUT ===',
          ...data.out,
          '',
          '=== STDERR ===',
          ...data.error,
        ];
        setLogs(combined);
      } else if (logType === 'docker' && selectedContainer) {
        const params = buildDockerParams();
        const endpoint =
          selectedSourceId === LIVE_SOURCE_ID
            ? `/logs?type=docker&${params.toString()}`
            : `/logs/docker/archive?${params.toString()}`;

        const { data } = await api.get(endpoint);
        setLogs(data.logs);
      } else if (logType !== 'docker') {
        const { data } = await api.get(
          `/logs?type=${logType}&lines=${effectiveLineCount}`,
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

  const loadCatchupLogs = async (since: string | null) => {
    if (!since || !selectedContainer) {
      return;
    }

    try {
      const params = buildDockerParams({
        lines: STREAM_CATCHUP_LINE_COUNT,
        since,
        until: null,
        sourceId: LIVE_SOURCE_ID,
      });
      const { data } = await api.get(`/logs?type=docker&${params.toString()}`);
      const incoming = (data.logs ?? []) as string[];
      setLogs((current) => appendUniqueLines(current, incoming, lineCount));
    } catch (error) {
      console.error('Failed to load catch-up logs:', error);
    }
  };

  useEffect(() => {
    if (logType === 'docker') {
      void loadDockerContainers();
      void loadArchiveSources();
    }
    void loadLogs();
  }, [
    logType,
    selectedContainer,
    selectedContainerName,
    selectedSourceId,
    lineCount,
    dockerTimestamps,
    dockerSince,
    dockerStartAt,
    dockerEndAt,
    dockerFilter,
  ]);

  useEffect(() => {
    if (!autoRefresh || canUseLiveStream) {
      return;
    }

    const interval = setInterval(() => {
      void loadLogs();
    }, 3000);

    return () => clearInterval(interval);
  }, [
    autoRefresh,
    canUseLiveStream,
    logType,
    selectedContainer,
    selectedSourceId,
    lineCount,
    dockerTimestamps,
    dockerSince,
    dockerStartAt,
    dockerEndAt,
    dockerFilter,
  ]);

  useEffect(() => {
    if (!autoRefresh || !canUseLiveStream) {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      setStreamStatus('idle');
      setStreamError(null);
      setStreamReconnectAttempt(0);
      return;
    }

    const token = useAuthStore.getState().token;
    if (!token) {
      setStreamStatus('error');
      setStreamError('로그인 토큰이 없어 실시간 스트림을 열 수 없습니다.');
      return;
    }

    let source: EventSource | null = null;
    let disposed = false;
    let reconnectAttempts = 0;

    const cleanupSource = () => {
      if (source) {
        source.close();
        source = null;
      }
    };

    const openStream = async (cursorSince?: string | null) => {
      if (disposed) {
        return;
      }

      if (cursorSince) {
        await loadCatchupLogs(cursorSince);
      }

      const params = new URLSearchParams({
        containerId: selectedContainer,
        containerName: selectedContainerName,
        timestamps: String(dockerTimestamps),
        token,
      });

      if (dockerWindow.since) {
        params.set('since', dockerWindow.since);
      }

      if (dockerFilter !== 'all') {
        params.set('filter', dockerFilter);
      }

      setStreamStatus(reconnectAttempts > 0 ? 'reconnecting' : 'connecting');
      setStreamError(null);
      source = new EventSource(
        `${API_URL}/api/logs/docker/stream?${params.toString()}`,
      );

      const handleReady = () => {
        reconnectAttempts = 0;
        setStreamReconnectAttempt(0);
        setStreamStatus('live');
        lastSeenAtRef.current = new Date().toISOString();
      };

      const handleLine = (event: MessageEvent<string>) => {
        try {
          const payload = JSON.parse(event.data) as { line?: string };
          if (!payload.line) {
            return;
          }

          const lineTimestamp =
            parseLogTimestamp(payload.line) ?? new Date().toISOString();
          lastSeenAtRef.current = lineTimestamp;
          setLogs((current) =>
            capStreamLines([...current, payload.line!], lineCount),
          );
        } catch (error) {
          console.error('Failed to parse log stream payload:', error);
        }
      };

      const scheduleReconnect = () => {
        if (disposed) {
          return;
        }

        if (reconnectTimerRef.current) {
          return;
        }

        cleanupSource();

        if (reconnectAttempts >= STREAM_RECONNECT_MAX_ATTEMPTS) {
          setStreamStatus('error');
          setStreamError('실시간 로그 스트림 재연결 한도를 넘었습니다.');
          return;
        }

        reconnectAttempts += 1;
        setStreamReconnectAttempt(reconnectAttempts);
        setStreamStatus('reconnecting');

        const delay = Math.min(2000 * reconnectAttempts, 10000);
        setStreamError(
          `${Math.ceil(delay / 1000)}초 후 실시간 스트림을 자동으로 다시 연결합니다.`,
        );

        const cursorSince =
          lastSeenAtRef.current ??
          new Date(Date.now() - 30_000).toISOString();

        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null;
          void openStream(cursorSince);
        }, delay);
      };

      const handleEnd = () => {
        setStreamStatus('ended');
        scheduleReconnect();
      };

      const handleErrorEvent = () => {
        if (disposed) {
          return;
        }

        if (source?.readyState === EventSource.CLOSED) {
          scheduleReconnect();
          return;
        }

        scheduleReconnect();
      };

      source.addEventListener('ready', handleReady as EventListener);
      source.addEventListener('line', handleLine as EventListener);
      source.addEventListener('end', handleEnd as EventListener);
      source.addEventListener('error', handleErrorEvent as EventListener);
    };

    void openStream(null);

    return () => {
      disposed = true;
      cleanupSource();
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      setStreamStatus('idle');
    };
  }, [
    autoRefresh,
    canUseLiveStream,
    selectedContainer,
    selectedContainerName,
    lineCount,
    dockerTimestamps,
    dockerFilter,
    dockerWindow.since,
  ]);

  useEffect(() => {
    if (logType !== 'docker' && lineCount === 'all') {
      setLineCount(DEFAULT_LINE_COUNT);
    }
  }, [logType, lineCount]);

  useEffect(() => {
    setSelectedSourceId(LIVE_SOURCE_ID);
  }, [selectedContainer]);

  useEffect(() => {
    if (isArchiveMode && autoRefresh) {
      setAutoRefresh(false);
    }
  }, [autoRefresh, isArchiveMode]);

  useEffect(() => {
    if (logType === 'docker' && dockerSince === 'custom' && autoRefresh) {
      setAutoRefresh(false);
    }
  }, [autoRefresh, dockerSince, logType]);

  useEffect(() => {
    if (!isNginxContainer && dockerFilter !== 'all' && dockerFilter !== 'errors') {
      setDockerFilter('all');
    }
  }, [dockerFilter, isNginxContainer]);

  useEffect(() => {
    if (dockerSince !== 'custom') {
      return;
    }

    if (!dockerStartAt) {
      setDockerStartAt(formatDateTimeLocal(new Date(Date.now() - 60 * 60 * 1000)));
    }

    if (!dockerEndAt) {
      setDockerEndAt(formatDateTimeLocal(new Date()));
    }
  }, [dockerEndAt, dockerSince, dockerStartAt]);

  const downloadLogs = () => {
    const metadata = [
      `# exportedAt: ${new Date().toISOString()}`,
      `# type: ${logType}`,
      logType === 'docker' ? `# containerId: ${selectedContainer}` : null,
      logType === 'docker' ? `# containerName: ${selectedContainerName}` : null,
      logType === 'docker'
        ? `# source: ${selectedSourceId === LIVE_SOURCE_ID ? 'live' : 'archive'}`
        : null,
      logType === 'docker' && selectedArchiveSource
        ? `# sourcePath: ${selectedArchiveSource.path}`
        : null,
      logType === 'docker' ? `# lineCount: ${effectiveLineCount}` : null,
      logType === 'docker' ? `# timestamps: ${dockerTimestamps}` : null,
      logType === 'docker' ? `# since: ${dockerWindow.since ?? 'none'}` : null,
      logType === 'docker' ? `# until: ${dockerWindow.until ?? 'none'}` : null,
      logType === 'docker' ? `# filter: ${dockerFilter}` : null,
      logType === 'docker' ? `# streamStatus: ${streamStatus}` : null,
      `# totalLines: ${logs.length}`,
      '',
    ]
      .filter(Boolean)
      .join('\n');

    const content = `${metadata}${logs.join('\n')}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const scope =
      logType === 'docker'
        ? selectedSourceId === LIVE_SOURCE_ID
          ? 'live'
          : selectedSourceId.replace(/[^a-zA-Z0-9_.-]/g, '_')
        : 'logs';
    a.download = `${logType}-${scope}-${new Date().toISOString()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadOlderLogs = () => {
    setLineCount((current) => {
      const currentIndex = DOCKER_TAIL_STEPS.findIndex((step) => step === current);
      if (currentIndex === -1) {
        return DOCKER_TAIL_STEPS[0];
      }

      return DOCKER_TAIL_STEPS[
        Math.min(currentIndex + 1, DOCKER_TAIL_STEPS.length - 1)
      ];
    });
  };

  const resetLogWindow = () => {
    setLineCount(DEFAULT_LINE_COUNT);
  };

  const filteredLogs = useMemo(
    () =>
      searchTerm
        ? logs.filter((log) =>
            log.toLowerCase().includes(searchTerm.toLowerCase()),
          )
        : logs,
    [logs, searchTerm],
  );

  const canLoadOlderLogs = logType === 'docker' && lineCount !== 'all';

  return {
    logType,
    setLogType,
    logs,
    autoRefresh,
    setAutoRefresh,
    searchTerm,
    setSearchTerm,
    lineCount,
    setLineCount,
    dockerTimestamps,
    setDockerTimestamps,
    dockerSince,
    setDockerSince,
    dockerStartAt,
    setDockerStartAt,
    dockerEndAt,
    setDockerEndAt,
    dockerFilter,
    setDockerFilter,
    archiveSources,
    selectedSourceId,
    setSelectedSourceId,
    selectedArchiveSource,
    isArchiveMode,
    streamStatus,
    streamError,
    streamReconnectAttempt,
    isNginxContainer,
    isLoading,
    isArchiveLoading,
    logsEndRef,
    loadLogs,
    loadArchiveSources,
    downloadLogs,
    scrollToBottom,
    loadOlderLogs,
    resetLogWindow,
    effectiveLineCount,
    canLoadOlderLogs,
    filteredLogs,
    dockerWindow,
    canUseLiveStream,
  };
}
