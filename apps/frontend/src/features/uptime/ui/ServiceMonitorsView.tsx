import { useState } from 'react';
import { Activity, Plus, Trash2 } from 'lucide-react';
import { useModalStore, usePermissions } from '@/shared/model';
import { PERMISSIONS } from '@/shared/config/permissions';
import { uptimeService } from '../api/uptime.service';
import { useServiceMonitors } from '../model/useServiceMonitors';
import type { ServiceMonitor } from '../model/uptime.types';
import { AddMonitorDialog } from './AddMonitorDialog';
import { LatencyBars } from './LatencyBars';

const STATE = {
  up: { dot: 'bg-emerald-400', label: '정상', text: 'text-emerald-300' },
  down: {
    dot: 'bg-red-500 animate-pulse',
    label: '끊김',
    text: 'text-red-300',
  },
  unknown: { dot: 'bg-gray-500', label: '확인 중', text: 'text-gray-400' },
} as const;

function since(iso: string | null): string {
  if (!iso) return '-';
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours}시간 전` : `${Math.round(hours / 24)}일 전`;
}

/** Uptime Kuma 처럼: 주소별 지금 상태, 24시간 가동률, 평균 응답, 최근 검사 막대 */
export function ServiceMonitorsView() {
  const { monitors, error, reload } = useServiceMonitors();
  const { hasPermission } = usePermissions();
  const { showConfirm, showAlert } = useModalStore();
  const [adding, setAdding] = useState(false);
  const canWrite = hasPermission(PERMISSIONS.SYSTEM_WRITE);
  const down = monitors?.filter((m) => m.state === 'down').length ?? 0;

  const remove = (monitor: ServiceMonitor) =>
    showConfirm(
      `${monitor.name} 감시를 지울까요? 검사 기록도 함께 지워집니다.`,
      async () => {
        try {
          await uptimeService.remove(monitor.id);
          await reload();
        } catch (e) {
          showAlert(e instanceof Error ? e.message : '지우지 못했습니다.');
        }
      },
      '감시 지우기',
    );

  return (
    <div className="h-full overflow-auto bg-gray-950 p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="mr-auto">
          <h2 className="hidden text-2xl font-bold text-white md:block">
            서비스 감시
          </h2>
          <p className="text-sm text-gray-400">
            {monitors === null
              ? '불러오는 중…'
              : monitors.length === 0
                ? '감시하는 주소가 없습니다.'
                : down > 0
                  ? `${monitors.length}곳 중 ${down}곳 끊김`
                  : `${monitors.length}곳 모두 정상`}
          </p>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-500"
          >
            <Plus size={16} /> 추가
          </button>
        )}
      </div>

      {error ? (
        <p className="mb-4 rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {monitors?.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-700 p-6 text-center text-sm text-gray-400">
          <Activity className="mx-auto mb-2 text-gray-500" />
          블로그·API 처럼 밖에서 열리는 주소를 추가하면 1분마다 열어 보고,
          끊기면 알려 드립니다.
        </div>
      )}

      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {monitors?.map((monitor) => {
          const state = STATE[monitor.state];
          return (
            <li
              key={monitor.id}
              className="min-w-0 rounded-xl border border-gray-800 bg-gray-900 p-4"
            >
              <div className="flex items-start gap-2">
                <span
                  className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${state.dot}`}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-white">
                    {monitor.name}{' '}
                    <span className={`text-xs font-normal ${state.text}`}>
                      {state.label}
                    </span>
                  </p>
                  <a
                    href={monitor.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-xs text-gray-500 hover:text-gray-300"
                  >
                    {monitor.url}
                  </a>
                </div>
                {canWrite && (
                  <button
                    type="button"
                    onClick={() => remove(monitor)}
                    aria-label={`${monitor.name} 감시 지우기`}
                    className="shrink-0 rounded p-1.5 text-gray-500 hover:bg-gray-800 hover:text-red-300"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-gray-950/60 py-2">
                  <dt className="text-[11px] text-gray-500">24시간</dt>
                  <dd className="text-sm font-semibold text-gray-100">
                    {monitor.uptime24hPercent === null
                      ? '-'
                      : `${monitor.uptime24hPercent}%`}
                  </dd>
                </div>
                <div className="rounded-lg bg-gray-950/60 py-2">
                  <dt className="text-[11px] text-gray-500">평균 응답</dt>
                  <dd className="text-sm font-semibold text-gray-100">
                    {monitor.averageLatencyMs === null
                      ? '-'
                      : `${monitor.averageLatencyMs}ms`}
                  </dd>
                </div>
                <div className="rounded-lg bg-gray-950/60 py-2">
                  <dt className="text-[11px] text-gray-500">마지막 확인</dt>
                  <dd className="text-sm font-semibold text-gray-100">
                    {since(monitor.lastCheckedAt)}
                  </dd>
                </div>
              </dl>
              {monitor.recent.length > 0 && (
                <div className="mt-3">
                  <LatencyBars recent={monitor.recent} />
                </div>
              )}
              {monitor.lastError && (
                <p className="mt-2 text-xs text-red-300">
                  마지막 실패: {monitor.lastError}
                </p>
              )}
              {monitor.state === 'down' && monitor.stateChangedAt && (
                <p className="mt-1 text-xs text-red-300/80">
                  {since(monitor.stateChangedAt)}부터 끊김
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <AddMonitorDialog
        open={adding}
        onClose={() => setAdding(false)}
        onAdded={() => void reload()}
      />
    </div>
  );
}
