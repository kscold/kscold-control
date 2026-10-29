import { useState } from 'react';
import { dockerService } from '@/entities/container';
import { PERMISSIONS } from '@/shared/config/permissions';
import { usePermissions } from '@/shared/lib';
import { useModalStore } from '@/shared/model';
import { TopologyCanvas } from './TopologyCanvas';
import { TopologyLegend } from './TopologyLegend';
import { TopologySkeleton } from './TopologySkeleton';
import { useTopologySnapshot } from '../model/useTopologySnapshot';

export function TopologyView() {
  const { snapshot, loading, error, reload } = useTopologySnapshot();
  const { hasPermission } = usePermissions();
  const { showConfirm, showAlert } = useModalStore();
  const [resettingLayout, setResettingLayout] = useState(false);
  // 캔버스는 화면에 있는 좌표를 기억하므로, 기본 배치로 되돌릴 때는 새로 그리게 키를 바꾼다
  const [canvasKey, setCanvasKey] = useState(0);
  const showSkeleton = loading && !snapshot && !error;

  const handleResetLayout = () =>
    showConfirm(
      '옮겨 둔 노드 배치를 지우고 기본 배치로 다시 그릴까요?\n다른 사람의 배치와 서비스에는 영향이 없습니다.',
      () => {
        void (async () => {
          setResettingLayout(true);
          try {
            await dockerService.resetTopologyLayout();
            await reload();
            setCanvasKey((key) => key + 1);
          } catch (resetError) {
            showAlert(
              resetError instanceof Error
                ? resetError.message
                : String(resetError),
              '자동 정렬 실패',
            );
          } finally {
            setResettingLayout(false);
          }
        })();
      },
      '자동 정렬',
    );

  return (
    <div className="h-full w-full bg-gray-950 relative">
      {showSkeleton ? null : (
        <TopologyLegend
          loading={loading}
          onRefresh={reload}
          generatedAt={snapshot?.summary.generatedAt ?? null}
          onResetLayout={
            hasPermission(PERMISSIONS.DOCKER_UPDATE)
              ? handleResetLayout
              : undefined
          }
          resettingLayout={resettingLayout}
        />
      )}

      {error ? (
        <div className="flex h-full items-center justify-center px-4">
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-6 py-4 text-sm text-red-100">
            {error}
          </div>
        </div>
      ) : showSkeleton ? (
        <TopologySkeleton />
      ) : (
        <TopologyCanvas key={canvasKey} snapshot={snapshot} />
      )}
    </div>
  );
}
