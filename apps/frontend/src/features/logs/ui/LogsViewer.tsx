import {
  Activity,
  Archive,
  Clock3,
  Download,
  Filter,
  History,
  Radio,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import { useLogs } from '../model/useLogs';
import { useDockerContainers } from '../model/useDockerContainers';
import type {
  DockerLogArchiveSource,
  DockerLogFilter,
  DockerLogSince,
  LogLineCount,
  LogType,
} from '../model/logs.types';

const DEFAULT_LINE_OPTIONS: LogLineCount[] = [50, 100, 200, 500, 1000];
const DOCKER_LINE_OPTIONS: LogLineCount[] = [
  50,
  100,
  200,
  500,
  1000,
  5000,
  10000,
  'all',
];
const DOCKER_SINCE_OPTIONS: Array<{ value: DockerLogSince; label: string }> = [
  { value: 'none', label: '전체 기간' },
  { value: '15m', label: '최근 15분' },
  { value: '1h', label: '최근 1시간' },
  { value: '6h', label: '최근 6시간' },
  { value: '24h', label: '최근 24시간' },
  { value: '168h', label: '최근 7일' },
  { value: 'custom', label: '직접 범위' },
];
const BASE_FILTER_OPTIONS: Array<{
  value: DockerLogFilter;
  label: string;
}> = [
  { value: 'all', label: '전체' },
  { value: 'errors', label: '에러만' },
];
const NGINX_FILTER_OPTIONS: Array<{
  value: DockerLogFilter;
  label: string;
}> = [
  ...BASE_FILTER_OPTIONS,
  { value: 'nginx-access', label: 'Access' },
  { value: 'nginx-error', label: 'Nginx Error' },
];
const LIVE_SOURCE_ID = 'live';

function formatLineOption(option: LogLineCount) {
  return option === 'all' ? '전체' : `${option} 줄`;
}

function formatBytes(size: number) {
  if (size <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(
    Math.floor(Math.log(size) / Math.log(1024)),
    units.length - 1,
  );
  const value = size / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function formatSourceTimestamp(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatScopeTimestamp(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDockerBadgeTone(name: string) {
  if (name === 'kscold-nginx') {
    return 'border-amber-500/40 bg-amber-500/10 text-amber-200';
  }

  if (name === 'kscold-infra-db') {
    return 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200';
  }

  return 'border-gray-700 bg-gray-800 text-gray-200';
}

function getSourceLabel(source: DockerLogArchiveSource) {
  if (source.type === 'current') {
    return '현재 json.log';
  }

  return source.compressed ? `${source.label} (.gz)` : source.label;
}

function getWindowLabel(
  dockerSince: DockerLogSince,
  window: { since: string | null; until: string | null },
) {
  if (dockerSince !== 'custom') {
    return (
      DOCKER_SINCE_OPTIONS.find((option) => option.value === dockerSince)
        ?.label ?? '전체 기간'
    );
  }

  const start = formatScopeTimestamp(window.since) ?? '시작 미지정';
  const end = formatScopeTimestamp(window.until) ?? '현재 시점';
  return `${start} ~ ${end}`;
}

export function LogsViewer() {
  const {
    dockerContainers,
    selectedContainer,
    setSelectedContainer,
    loadDockerContainers,
  } = useDockerContainers();
  const selectedContainerInfo = dockerContainers.find(
    (container) => container.id === selectedContainer,
  );

  const {
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
  } = useLogs({
    selectedContainer,
    selectedContainerName: selectedContainerInfo?.name ?? '',
    loadDockerContainers,
  });

  const isDockerLog = logType === 'docker';
  // 퀵 필터는 실행 중인 컨테이너만 보여준다.
  // 컨테이너 이름을 하드코딩하면 인프라가 바뀔 때마다 목록이 낡으므로
  // (제거된 galjido 가 남아 있었다) 현재 상태를 기준으로 판단한다.
  const quickContainers = dockerContainers.filter((container) =>
    container.status.startsWith('Up'),
  );
  const lineOptions = isDockerLog ? DOCKER_LINE_OPTIONS : DEFAULT_LINE_OPTIONS;
  const sourceLabel =
    isDockerLog && selectedSourceId !== LIVE_SOURCE_ID
      ? selectedArchiveSource
        ? getSourceLabel(selectedArchiveSource)
        : '선택한 archive'
      : 'live stream';
  const scopeLabel =
    effectiveLineCount === 'all'
      ? isArchiveMode
        ? '선택한 아카이브 전체'
        : '전체 stdout/stderr'
      : `최근 ${effectiveLineCount}줄`;
  const sinceLabel = getWindowLabel(dockerSince, dockerWindow);
  const activeFilterOptions = isNginxContainer
    ? NGINX_FILTER_OPTIONS
    : BASE_FILTER_OPTIONS;
  const activeFilterLabel =
    activeFilterOptions.find((option) => option.value === dockerFilter)
      ?.label ?? '전체';

  const streamStatusMeta = {
    idle: {
      label: isArchiveMode ? 'ARCHIVE' : 'READY',
      tone: 'border-gray-700 bg-gray-800 text-gray-200',
      detail: isArchiveMode
        ? '선택한 보관 로그를 정적으로 조회 중'
        : '수동 새로고침 또는 Follow 대기',
    },
    connecting: {
      label: 'CONNECTING',
      tone: 'border-amber-500/40 bg-amber-500/10 text-amber-100',
      detail: 'docker logs -f 스트림 연결 중',
    },
    live: {
      label: 'LIVE',
      tone: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100',
      detail: '실시간 스트림으로 새 로그를 수신 중',
    },
    reconnecting: {
      label: 'RECONNECT',
      tone: 'border-sky-500/40 bg-sky-500/10 text-sky-100',
      detail:
        streamReconnectAttempt > 0
          ? `${streamReconnectAttempt}회차 자동 재연결 중`
          : '자동 재연결 준비 중',
    },
    ended: {
      label: 'ENDED',
      tone: 'border-gray-700 bg-gray-800 text-gray-300',
      detail: '스트림이 종료됨',
    },
    error: {
      label: 'ERROR',
      tone: 'border-red-500/40 bg-red-500/10 text-red-100',
      detail: streamError ?? '스트림 연결 중 문제가 발생함',
    },
  }[streamStatus];

  const followDisabledReason = isArchiveMode
    ? 'archive source는 정적인 스냅샷이라 follow를 지원하지 않습니다.'
    : !selectedContainer
      ? '컨테이너를 먼저 선택하세요.'
      : dockerSince === 'custom'
        ? '직접 범위 조회는 follow 대신 정적 조회만 지원합니다.'
        : 'Follow';

  return (
    <div className="flex h-full flex-col bg-gray-900 p-4 sm:p-6">
      <div className="mb-4">
        <h1 className="flex items-center gap-2 text-xl font-bold text-white sm:text-2xl">
          <Terminal size={28} />
          시스템 로그
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          Docker live stream, json-file archive, 날짜 범위 조회, 에러 중심
          필터를 한 화면에서 바로 확인할 수 있습니다.
        </p>
      </div>

      <div className="mb-4 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
          <select
            value={logType}
            onChange={(e) => setLogType(e.target.value as LogType)}
            className="flex-1 rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <optgroup label="kscold-control">
              <option value="backend">Backend (stdout)</option>
              <option value="pm2">PM2 (stdout + stderr)</option>
              <option value="nginx-access">Nginx Access</option>
              <option value="nginx-error">Nginx Error</option>
              <option value="docker">Docker Container</option>
            </optgroup>
            <optgroup label="kscold-blog">
              <option value="blog-backend">Blog Backend (stdout)</option>
              <option value="blog-backend-err">Blog Backend (stderr)</option>
              <option value="blog-access">Blog Access Log</option>
              <option value="blog-frontend">Blog Frontend (stdout)</option>
              <option value="blog-frontend-err">Blog Frontend (stderr)</option>
            </optgroup>
          </select>

          {isDockerLog && (
            <select
              value={selectedContainer}
              onChange={(e) => setSelectedContainer(e.target.value)}
              className="flex-1 rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            value={String(lineCount)}
            onChange={(e) =>
              setLineCount(
                e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10),
              )
            }
            className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-36"
          >
            {lineOptions.map((option) => (
              <option key={String(option)} value={String(option)}>
                {formatLineOption(option)}
              </option>
            ))}
          </select>
        </div>

        {isDockerLog && quickContainers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {quickContainers.map((container) => {
              const isActive = container.id === selectedContainer;
              return (
                <button
                  key={container.id}
                  onClick={() => setSelectedContainer(container.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    isActive
                      ? 'border-blue-500 bg-blue-500/20 text-blue-100'
                      : getDockerBadgeTone(container.name)
                  }`}
                >
                  {container.name}
                </button>
              );
            })}
          </div>
        )}

        {isDockerLog && selectedContainerInfo && (
          <div className="rounded-xl border border-white/10 bg-gray-800/60 p-3">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.24em] text-gray-500">
                    Log Sources
                  </div>
                  <div className="mt-1 text-sm font-semibold text-white">
                    live stream과 회전된 docker json-file을 전환해서 볼 수
                    있습니다.
                  </div>
                </div>

                <button
                  onClick={loadArchiveSources}
                  disabled={isArchiveLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-gray-900 px-3 py-2 text-xs text-gray-200 transition hover:border-blue-500/40 hover:text-white disabled:opacity-50"
                >
                  <RefreshCw
                    size={14}
                    className={isArchiveLoading ? 'animate-spin' : ''}
                  />
                  소스 새로고침
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedSourceId(LIVE_SOURCE_ID)}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${
                    selectedSourceId === LIVE_SOURCE_ID
                      ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-50'
                      : 'border-gray-700 bg-gray-900 text-gray-200'
                  }`}
                >
                  <Radio size={14} />
                  Live
                </button>

                {archiveSources.map((source) => {
                  const active = source.id === selectedSourceId;
                  return (
                    <button
                      key={source.id}
                      onClick={() => setSelectedSourceId(source.id)}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${
                        active
                          ? 'border-violet-500/50 bg-violet-500/20 text-violet-50'
                          : 'border-gray-700 bg-gray-900 text-gray-200'
                      }`}
                    >
                      <Archive size={14} />
                      {getSourceLabel(source)}
                    </button>
                  );
                })}
              </div>

              {selectedArchiveSource ? (
                <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 text-xs text-violet-100">
                  <div className="font-semibold text-violet-50">
                    선택한 archive
                  </div>
                  <div className="mt-1 break-all text-violet-100/90">
                    {selectedArchiveSource.path}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-violet-100/80">
                    <span>{formatBytes(selectedArchiveSource.size)}</span>
                    <span>
                      {formatSourceTimestamp(selectedArchiveSource.modifiedAt)}
                    </span>
                    <span>
                      {selectedArchiveSource.compressed
                        ? '압축된 회전 로그'
                        : '일반 json-file'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-gray-400">
                  {isArchiveLoading
                    ? 'archive source 목록을 불러오는 중입니다.'
                    : archiveSources.length > 0
                      ? 'Live를 선택하면 현재 stdout/stderr를 follow하고, archive를 선택하면 보관된 json-file을 조회합니다.'
                      : '현재 이 컨테이너에서 확인된 회전 로그 파일이 없습니다.'}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
          <div className="relative flex-1">
            <Filter
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={16}
            />
            <input
              type="text"
              placeholder="로그 필터링..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded border border-gray-700 bg-gray-800 py-2 pl-9 pr-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={loadLogs}
              disabled={isLoading}
              className="flex items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={isLoading ? 'animate-spin' : ''}
              />
              새로고침
            </button>

            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              disabled={isDockerLog && !canUseLiveStream}
              className={`flex items-center justify-center gap-1.5 rounded px-3 py-2 text-sm ${
                autoRefresh
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
              } disabled:cursor-not-allowed disabled:opacity-40`}
              title={isDockerLog ? followDisabledReason : '자동 새로고침'}
            >
              <Activity size={16} />
              {isDockerLog ? 'Follow' : '자동'}
            </button>

            {isDockerLog && (
              <select
                value={dockerSince}
                onChange={(e) =>
                  setDockerSince(e.target.value as DockerLogSince)
                }
                className="rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="since"
              >
                {DOCKER_SINCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}

            {isDockerLog && (
              <button
                onClick={() => setDockerTimestamps(!dockerTimestamps)}
                className={`flex items-center justify-center gap-1.5 rounded px-3 py-2 text-sm ${
                  dockerTimestamps
                    ? 'bg-cyan-600 text-white hover:bg-cyan-700'
                    : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                }`}
                title="timestamps"
              >
                <Clock3 size={16} />
                시간표시
              </button>
            )}

            {isDockerLog && (
              <button
                onClick={loadOlderLogs}
                disabled={!canLoadOlderLogs}
                className="flex items-center justify-center gap-1.5 rounded bg-gray-700 px-3 py-2 text-sm text-gray-200 hover:bg-gray-600 disabled:opacity-40"
                title="더 이전 로그까지 확장"
              >
                <History size={16} />더 이전
              </button>
            )}

            {isDockerLog && (
              <button
                onClick={resetLogWindow}
                disabled={effectiveLineCount === 200}
                className="rounded bg-gray-700 px-3 py-2 text-sm text-gray-200 hover:bg-gray-600 disabled:opacity-40"
              >
                최근만
              </button>
            )}

            <button
              onClick={downloadLogs}
              className="flex items-center justify-center gap-1.5 rounded bg-gray-700 px-3 py-2 text-sm text-white hover:bg-gray-600"
              title="다운로드"
            >
              <Download size={16} />
              다운로드
            </button>
          </div>
        </div>

        {isDockerLog && dockerSince === 'custom' && (
          <div className="grid gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm text-gray-300">
              <span className="text-xs uppercase tracking-[0.24em] text-gray-500">
                Start
              </span>
              <input
                aria-label="시작 시각"
                type="datetime-local"
                value={dockerStartAt}
                onChange={(e) => setDockerStartAt(e.target.value)}
                className="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <label className="space-y-1 text-sm text-gray-300">
              <span className="text-xs uppercase tracking-[0.24em] text-gray-500">
                End
              </span>
              <input
                aria-label="끝 시각"
                type="datetime-local"
                value={dockerEndAt}
                onChange={(e) => setDockerEndAt(e.target.value)}
                className="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <div className="sm:col-span-2 text-xs text-blue-100/80">
              직접 범위 조회는 시점 고정 조회입니다. 이 모드에서는 Follow 대신
              정적 조회와 메타 포함 다운로드를 사용합니다.
            </div>
          </div>
        )}

        {isDockerLog && selectedContainerInfo && (
          <div className="flex flex-wrap gap-2">
            {activeFilterOptions.map((option) => {
              const active = dockerFilter === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => setDockerFilter(option.value)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    active
                      ? 'border-cyan-500 bg-cyan-500/20 text-cyan-100'
                      : 'border-gray-700 bg-gray-800 text-gray-200'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        )}

        {isDockerLog && selectedContainerInfo && (
          <div className="grid gap-2 sm:grid-cols-4">
            <div className="rounded-lg border border-white/10 bg-gray-800/80 p-3">
              <div className="text-[11px] uppercase tracking-[0.24em] text-gray-500">
                Container
              </div>
              <div className="mt-1 text-sm font-semibold text-white">
                {selectedContainerInfo.name}
              </div>
              <div className="mt-1 text-xs text-gray-400">
                {selectedContainerInfo.status}
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-gray-800/80 p-3">
              <div className="text-[11px] uppercase tracking-[0.24em] text-gray-500">
                Source
              </div>
              <div className="mt-1 text-sm font-semibold text-white">
                {sourceLabel}
              </div>
              <div className="mt-1 text-xs text-gray-400">
                {isArchiveMode
                  ? '보관된 docker json-file 스냅샷'
                  : '현재 stdout/stderr live view'}
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-gray-800/80 p-3">
              <div className="text-[11px] uppercase tracking-[0.24em] text-gray-500">
                Scope
              </div>
              <div className="mt-1 text-sm font-semibold text-white">
                {scopeLabel}
              </div>
              <div className="mt-1 text-xs text-gray-400">
                {sinceLabel} 기준, 필터 {activeFilterLabel}
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-gray-800/80 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.24em] text-gray-500">
                    Runtime
                  </div>
                  <div className="mt-1 text-sm font-semibold text-white">
                    {dockerTimestamps ? 'timestamps on' : 'timestamps off'}
                  </div>
                </div>
                <span
                  className={`rounded-full border px-2 py-1 text-[10px] font-semibold tracking-[0.24em] ${streamStatusMeta.tone}`}
                >
                  {streamStatusMeta.label}
                </span>
              </div>
              <div className="mt-1 text-xs text-gray-400">
                {streamStatusMeta.detail}
              </div>
              {streamError && (
                <div className="mt-2 text-xs text-red-300">{streamError}</div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto rounded-lg bg-black p-2 font-mono text-xs sm:p-4 sm:text-sm">
        <div className="whitespace-pre-wrap break-words text-green-400">
          {filteredLogs.length > 0 ? (
            filteredLogs.map((log, index) => (
              <div
                key={`${index}-${log.slice(0, 32)}`}
                className={`leading-relaxed ${
                  log.includes('ERROR') || log.includes('error')
                    ? 'text-red-400'
                    : log.includes('WARN') || log.includes('warn')
                      ? 'text-yellow-400'
                      : log.includes('===')
                        ? 'font-bold text-cyan-400'
                        : 'text-green-400'
                }`}
              >
                {log}
              </div>
            ))
          ) : (
            <div className="text-gray-500">
              {isDockerLog && !selectedContainer
                ? '컨테이너를 선택하면 로그를 불러옵니다.'
                : isArchiveMode
                  ? '선택한 archive source에 표시할 로그가 없습니다.'
                  : '로그가 없습니다.'}
            </div>
          )}
          <div ref={logsEndRef} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-400 sm:gap-4 sm:text-sm">
        <span>로드됨: {logs.length}줄</span>
        {isDockerLog && <span>범위: {scopeLabel}</span>}
        {isDockerLog && <span>source: {sourceLabel}</span>}
        {isDockerLog && <span>filter: {activeFilterLabel}</span>}
        {isDockerLog && <span>range: {sinceLabel}</span>}
        {searchTerm && <span>필터 결과: {filteredLogs.length}줄</span>}
        <span>다운로드에 source/filter/range 메타 포함</span>
        <button
          onClick={scrollToBottom}
          className="text-blue-400 underline hover:text-blue-300"
        >
          맨 아래로 ↓
        </button>
      </div>
    </div>
  );
}
