import { useState } from 'react';
import { dockerService } from '@/entities/container';
import { useModalStore } from '@/shared/model';
import type { Container } from '@/entities/container';

/**
 * 컨테이너 조작을 처리하는 훅 (시작, 중지, 삭제, 가져오기)
 */
export function useContainerActions(onSuccess?: () => void) {
  const [loading, setLoading] = useState(false);
  const { showAlert, showConfirm } = useModalStore();

  const startContainer = async (id: string) => {
    try {
      setLoading(true);
      await dockerService.startContainer(id);
      onSuccess?.();
    } catch (error) {
      console.error('Failed to start container:', error);
      showAlert('컨테이너 시작에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const stopContainer = async (id: string) => {
    try {
      setLoading(true);
      await dockerService.stopContainer(id);
      onSuccess?.();
    } catch (error) {
      console.error('Failed to stop container:', error);
      showAlert('컨테이너 중지에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const deleteContainer = (container: Container) => {
    showConfirm(
      container.isComposeManaged
        ? 'compose 서비스와 관리 정보를 함께 삭제합니다. 계속할까요?'
        : '정말 삭제하시겠습니까?',
      async () => {
        try {
          setLoading(true);
          if (container.isComposeManaged) {
            await dockerService.removeComposeService(container.name);
          } else {
            await dockerService.deleteContainer(container.id);
          }
          onSuccess?.();
        } catch (error) {
          console.error('Failed to delete container:', error);
          showAlert('컨테이너 삭제에 실패했습니다.');
        } finally {
          setLoading(false);
        }
      },
      '컨테이너 삭제',
    );
  };

  const importContainer = async (dockerId: string) => {
    try {
      setLoading(true);
      await dockerService.importContainer(dockerId);
      showAlert('컨테이너를 성공적으로 Import했습니다.');
      onSuccess?.();
    } catch (error) {
      console.error('Failed to import container:', error);
      showAlert('컨테이너 Import에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return {
    startContainer,
    stopContainer,
    deleteContainer,
    importContainer,
    loading,
  };
}
