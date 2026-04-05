import { RefreshCw } from 'lucide-react';
import { usePermissions } from '../../../hooks/usePermissions';
import { PERMISSIONS } from '../../../constants/permissions';
import { useDockerCleanupActions } from '../hooks';
import { DockerCleanupCategoryCard } from './DockerCleanupCategoryCard';
import { DockerCleanupSummaryCard } from './DockerCleanupSummaryCard';
import { SkeletonBlock } from '../../../shared/ui/SkeletonBlock';
import type { DockerCleanupCandidates } from '../lib/docker-cleanup.types';

interface DockerCleanupSectionProps {
  onRefreshContainers: () => void;
  candidates: DockerCleanupCandidates | null;
  loading: boolean;
  error: string | null;
  onReload: () => void;
}

export function DockerCleanupSection({
  onRefreshContainers,
  candidates,
  loading,
  error,
  onReload,
}: DockerCleanupSectionProps) {
  const { hasPermission } = usePermissions();
  const { results, runningAction, previewAction, confirmAndRunAction } =
    useDockerCleanupActions(() => {
      onReload();
      onRefreshContainers();
    });

  if (loading && !candidates) {
    return (
      <section className="mb-6 rounded-2xl border border-gray-800 bg-gray-950/60 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-2">
            <SkeletonBlock className="h-3 w-24 rounded-md" />
            <SkeletonBlock className="h-7 w-44 rounded-lg" />
          </div>
          <SkeletonBlock className="h-10 w-10 rounded-xl" />
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="rounded-2xl border border-gray-800 bg-gray-900/70 p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <SkeletonBlock className="h-7 w-36 rounded-lg" />
                <SkeletonBlock className="h-7 w-16 rounded-full" />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {Array.from({ length: 3 }).map((_, metricIndex) => (
                  <div
                    key={metricIndex}
                    className="rounded-xl border border-gray-800 bg-gray-950/50 p-3"
                  >
                    <SkeletonBlock className="h-3 w-14 rounded-md" />
                    <SkeletonBlock className="mt-2 h-8 w-16 rounded-md" />
                  </div>
                ))}
              </div>
              <SkeletonBlock className="mt-4 h-20 w-full rounded-xl" />
              <div className="mt-4 flex gap-2">
                <SkeletonBlock className="h-11 flex-1 rounded-xl" />
                <SkeletonBlock className="h-11 w-11 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (error && !candidates) {
    return (
      <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-100">
        {error}
      </div>
    );
  }

  if (!candidates) {
    return null;
  }

  const canDelete = hasPermission(PERMISSIONS.DOCKER_DELETE);

  return (
    <section className="mb-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-gray-500">
            Docker Cleanup
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">
            정리 후보와 안전 정리
          </h2>
        </div>
        <button
          type="button"
          onClick={onReload}
          className="rounded-lg border border-gray-700 px-3 py-2 text-gray-300 transition hover:bg-gray-800 hover:text-white"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {candidates.warnings.length ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <p className="font-medium">일부 정리 후보를 읽지 못했습니다.</p>
          <ul className="mt-2 space-y-1 text-amber-50/90">
            {candidates.warnings.map((warning) => (
              <li key={warning}>- {warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <DockerCleanupSummaryCard candidates={candidates} />

      <div className="grid gap-4 xl:grid-cols-2">
        <DockerCleanupCategoryCard
          title="Dangling 이미지"
          description="태그가 끊긴 이미지입니다. 현재 서비스에 연결되지 않은 경우만 정리 대상입니다."
          category={candidates.images}
          actionKey="images"
          result={results.images}
          loading={runningAction === 'images'}
          onPreview={previewAction}
          onExecute={canDelete ? confirmAndRunAction : undefined}
        />
        <DockerCleanupCategoryCard
          title="종료된 컨테이너"
          description="이미 종료되어 재시작되지 않는 컨테이너입니다. 실행 중인 서비스는 포함되지 않습니다."
          category={candidates.containers}
          actionKey="containers"
          result={results.containers}
          loading={runningAction === 'containers'}
          onPreview={previewAction}
          onExecute={canDelete ? confirmAndRunAction : undefined}
        />
        <DockerCleanupCategoryCard
          title="Dangling 볼륨"
          description="현재 어떤 컨테이너와도 연결되지 않은 볼륨만 후보로 보여줍니다."
          category={candidates.volumes}
          actionKey="volumes"
          result={results.volumes}
          loading={runningAction === 'volumes'}
          onPreview={previewAction}
          onExecute={canDelete ? confirmAndRunAction : undefined}
        />
        <DockerCleanupCategoryCard
          title="빌드 캐시"
          description="Docker build 과정에서 남은 캐시입니다. 다음 빌드가 조금 느려질 수 있습니다."
          category={candidates.buildCache}
          actionKey="buildCache"
          result={results.buildCache}
          loading={runningAction === 'buildCache'}
          onPreview={previewAction}
          onExecute={canDelete ? confirmAndRunAction : undefined}
        />
        <DockerCleanupCategoryCard
          title="Compose orphan 후보"
          description="현재 compose 파일에 없지만 Docker에는 남아 있는 컨테이너 후보입니다."
          category={candidates.composeOrphans}
        />
        <DockerCleanupCategoryCard
          title="배포 부산물 파일"
          description="dist, standalone, release, backup 계열 파일만 보기 전용으로 보여줍니다."
          category={candidates.artifactFiles}
        />
      </div>
    </section>
  );
}
