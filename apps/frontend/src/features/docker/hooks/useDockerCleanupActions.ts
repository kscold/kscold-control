import { useMemo, useState } from 'react';
import { dockerService } from '../../../services/api/docker.service';
import { useModalStore } from '../../../shared/model/modal.store';
import { formatBytes } from '../../../shared/lib';
import type { DockerCleanupResult } from '../lib/docker-cleanup.types';

export type DockerCleanupActionKey =
  | 'images'
  | 'containers'
  | 'volumes'
  | 'buildCache';

const ACTION_LABEL: Record<DockerCleanupActionKey, string> = {
  images: 'dangling 이미지 정리',
  containers: '종료된 컨테이너 정리',
  volumes: 'dangling 볼륨 정리',
  buildCache: '빌드 캐시 정리',
};

export function useDockerCleanupActions(onSuccess?: () => void) {
  const [runningAction, setRunningAction] =
    useState<DockerCleanupActionKey | null>(null);
  const [results, setResults] = useState<
    Partial<Record<DockerCleanupActionKey, DockerCleanupResult>>
  >({});
  const { showAlert, showConfirm } = useModalStore();

  const actionMap = useMemo(
    () => ({
      images: (dryRun: boolean) => dockerService.pruneDanglingImages(dryRun),
      containers: (dryRun: boolean) =>
        dockerService.pruneExitedContainers(dryRun),
      volumes: (dryRun: boolean) => dockerService.pruneDanglingVolumes(dryRun),
      buildCache: (dryRun: boolean) => dockerService.pruneBuildCache(dryRun),
    }),
    [],
  );

  const executeAction = async (
    key: DockerCleanupActionKey,
    dryRun: boolean,
  ) => {
    try {
      setRunningAction(key);
      const result = await actionMap[key](dryRun);
      setResults((prev) => ({ ...prev, [key]: result }));
      if (dryRun) {
        showAlert(
          `예상 절감 용량 ${formatBytes(result.reclaimedBytes)}\n정리 대상 ${result.removedCount}개`,
          ACTION_LABEL[key],
        );
        return;
      }

      showAlert(
        `정리를 완료했습니다.\n회수 용량 ${formatBytes(result.reclaimedBytes)}\n처리 항목 ${result.removedCount}개`,
        ACTION_LABEL[key],
      );
      onSuccess?.();
    } catch (err) {
      showAlert(
        err instanceof Error ? err.message : '정리 작업을 실행하지 못했습니다.',
        ACTION_LABEL[key],
      );
    } finally {
      setRunningAction(null);
    }
  };

  const previewAction = (key: DockerCleanupActionKey) =>
    executeAction(key, true);

  const confirmAndRunAction = (key: DockerCleanupActionKey) => {
    showConfirm(
      `${ACTION_LABEL[key]}을(를) 실행할까요?\n실행 전에 예상 절감 용량을 먼저 확인하는 것을 권장합니다.`,
      () => {
        void executeAction(key, false);
      },
      '안전 정리 실행',
    );
  };

  return {
    runningAction,
    results,
    previewAction,
    confirmAndRunAction,
  };
}
