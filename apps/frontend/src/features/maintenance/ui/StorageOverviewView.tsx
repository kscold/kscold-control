import { useState, type ReactNode } from 'react';
import { HardDrive, Loader2, RefreshCw, RotateCcw } from 'lucide-react';
import { PERMISSIONS } from '@/shared/config/permissions';
import { formatShortDateTime, usePermissions } from '@/shared/lib';
import { useModalStore } from '@/shared/model';
import { storageService } from '../api/storage.service';
import { formatSize } from '../lib/format';
import type { StorageOverview } from '../model/maintenance.types';
import { useStorageOverview } from '../model/useStorageOverview';
import { StorageDockerSection } from './StorageDockerSection';
import { StorageFolderList } from './StorageFolderList';

/** 이보다 적게 돌려받을 수 있으면 공간 반환을 권하지 않는다 */
const MIN_RECLAIM_BYTES = 1024 ** 3;
/** 파일시스템 메타데이터 정도의 차이는 돌려줄 공간이 없는 것으로 보여준다 */
const MIN_SHOWN_RECLAIM_BYTES = 64 * 1024 ** 2;

type Tone = 'ok' | 'warn' | 'danger';
type Notice = { tone: 'success' | 'error'; message: string };

const BAR_CLASS: Record<Tone, string> = {
  ok: 'bg-emerald-500',
  warn: 'bg-amber-500',
  danger: 'bg-red-500',
};
const VALUE_CLASS: Record<Tone, string> = {
  ok: 'text-white',
  warn: 'text-amber-200',
  danger: 'text-red-300',
};

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function hostTone(host: NonNullable<StorageOverview['host']>): Tone {
  const freeRatio = host.freeBytes / Math.max(host.totalBytes, 1);
  if (freeRatio < 0.1) return 'danger';
  if (freeRatio < 0.2) return 'warn';
  return 'ok';
}

function UsageBar({ ratio, tone }: { ratio: number; tone: Tone }) {
  return (
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-800">
      <div
        className={`h-full rounded-full ${BAR_CLASS[tone]}`}
        style={{ width: `${Math.min(100, Math.max(0, ratio * 100))}%` }}
      />
    </div>
  );
}

function SummaryCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4 sm:p-5">
      <h2 className="text-xs font-medium text-gray-400">{title}</h2>
      {children}
    </section>
  );
}

/** 저장공간 현황 — 맥 디스크, 도커 VM 디스크, 도커 안 사용량, 맥의 큰 폴더 */
export function StorageOverviewView() {
  const { hasPermission } = usePermissions();
  const { showConfirm } = useModalStore();
  const canManage = hasPermission(PERMISSIONS.SYSTEM_WRITE);
  const { overview, loading, error, reload } = useStorageOverview();
  const [trimming, setTrimming] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const host = overview?.host ?? null;
  const vm = overview?.dockerVm ?? null;
  const reclaimable = vm?.reclaimableBytes ?? 0;

  const handleTrim = () =>
    showConfirm(
      `도커 VM 안에서 지운 공간을 맥에 돌려줄까요?\n\n지금 돌려줄 수 있는 공간: ${formatSize(reclaimable)}\n서비스는 멈추지 않고 보통 몇 초면 끝납니다. 파일은 아무것도 지우지 않습니다.`,
      () => {
        void (async () => {
          setTrimming(true);
          try {
            const result = await storageService.trimDockerDisk();
            const returned = Math.max(
              0,
              result.allocatedBeforeBytes - result.allocatedAfterBytes,
            );
            setNotice({
              tone: 'success',
              message: `맥에 ${formatSize(returned)}를 돌려줬습니다. 도커 VM 디스크가 이제 ${formatSize(result.allocatedAfterBytes)}를 차지합니다.`,
            });
            await reload();
          } catch (caught) {
            setNotice({ tone: 'error', message: toMessage(caught) });
          } finally {
            setTrimming(false);
          }
        })();
      },
      '공간 반환',
    );

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-3 text-xl font-bold text-white sm:text-2xl">
            <HardDrive size={24} className="shrink-0 text-sky-400" />
            저장공간
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
            맥 디스크, 도커 VM, 컨테이너, 큰 폴더가 차지하는 공간을 한곳에서
            봅니다. 여기서는 아무것도 지우지 않고, 도커 VM의 빈 공간을 맥에
            돌려주는 것만 실행합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void reload({ refresh: true })}
          disabled={loading}
          className="inline-flex shrink-0 items-center gap-2 self-start rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-gray-300 hover:text-white disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          다시 재기
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300"
        >
          {error}
        </div>
      )}
      {notice && (
        <div
          role="status"
          className={`mb-4 rounded-lg border px-4 py-3 text-sm ${notice.tone === 'success' ? 'border-emerald-900/50 bg-emerald-950/30 text-emerald-200' : 'border-red-900/50 bg-red-950/30 text-red-300'}`}
        >
          {notice.message}
        </div>
      )}

      {!overview ? (
        loading && (
          <div className="flex flex-col items-center gap-3 py-16 text-sm text-gray-500">
            <Loader2 size={24} className="animate-spin text-gray-600" />
            폴더 크기를 재는 중입니다. 처음에는 30초쯤 걸릴 수 있어요.
          </div>
        )
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <SummaryCard title="맥 여유 공간">
              {host ? (
                <>
                  <p
                    className={`mt-2 text-2xl font-semibold ${VALUE_CLASS[hostTone(host)]}`}
                  >
                    {formatSize(host.freeBytes)} 남음
                  </p>
                  <UsageBar
                    ratio={host.usedBytes / Math.max(host.totalBytes, 1)}
                    tone={hostTone(host)}
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    전체 {formatSize(host.totalBytes)} 중{' '}
                    {Math.round(
                      (host.usedBytes / Math.max(host.totalBytes, 1)) * 100,
                    )}
                    % 사용
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-gray-500">읽지 못했습니다.</p>
              )}
            </SummaryCard>

            <SummaryCard title="도커 VM 디스크">
              {vm ? (
                <>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {formatSize(vm.allocatedBytes)}
                    <span className="ml-1.5 text-sm font-normal text-gray-500">
                      맥에서 차지
                    </span>
                  </p>
                  <dl className="mt-3 space-y-1 text-xs">
                    <div className="flex justify-between gap-3">
                      <dt className="text-gray-500">VM 안에서 쓰는 크기</dt>
                      <dd className="text-gray-300">
                        {vm.usedBytes === null
                          ? '읽지 못함'
                          : formatSize(vm.usedBytes)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-gray-500">돌려줄 수 있는 공간</dt>
                      <dd
                        className={
                          reclaimable >= MIN_RECLAIM_BYTES
                            ? 'font-medium text-amber-200'
                            : 'text-gray-300'
                        }
                      >
                        {vm.reclaimableBytes === null
                          ? '알 수 없음'
                          : vm.reclaimableBytes < MIN_SHOWN_RECLAIM_BYTES
                            ? '없음'
                            : formatSize(vm.reclaimableBytes)}
                      </dd>
                    </div>
                  </dl>
                  {canManage && (
                    <button
                      type="button"
                      onClick={handleTrim}
                      disabled={trimming || reclaimable < MIN_RECLAIM_BYTES}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-gray-800 disabled:text-gray-500"
                    >
                      {trimming ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <RotateCcw size={13} />
                      )}
                      공간 반환
                    </button>
                  )}
                  <p className="mt-2 text-xs leading-5 text-gray-500">
                    컨테이너·이미지를 지워도 VM 디스크는 바로 줄지 않습니다.
                    공간 반환을 해야 맥 여유 공간이 늘어납니다.
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-gray-500">읽지 못했습니다.</p>
              )}
            </SummaryCard>

            <SummaryCard title="다시 시작하면 돌아올 공간">
              <p className="mt-2 text-2xl font-semibold text-white">
                {vm?.heldDeletedBytes
                  ? formatSize(vm.heldDeletedBytes)
                  : '없음'}
              </p>
              <p className="mt-3 text-xs leading-5 text-gray-500">
                {vm?.heldDeletedBytes
                  ? `도커 VM이 열어 둔 채 지워진 맥 파일 ${vm.heldDeletedFiles}개입니다. 맥이나 Colima를 다시 시작할 때 돌아옵니다.`
                  : '도커 VM이 붙잡고 있는 지운 파일이 없습니다.'}
              </p>
            </SummaryCard>
          </div>

          {overview.docker && <StorageDockerSection docker={overview.docker} />}
          <StorageFolderList folders={overview.folders} />

          {overview.warnings.length > 0 && (
            <section className="rounded-2xl border border-amber-900/50 bg-amber-950/20 px-4 py-3 text-xs text-amber-200">
              <h2 className="font-semibold">일부 항목을 읽지 못했습니다</h2>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {overview.warnings.map((warning) => (
                  <li key={warning} className="break-all">
                    {warning}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="text-xs text-gray-600">
            {formatShortDateTime(overview.measuredAt)}에 쟀습니다. 10분 동안은
            같은 결과를 보여주니 바로 확인하려면 다시 재기를 누르세요.
          </p>
        </div>
      )}
    </div>
  );
}
