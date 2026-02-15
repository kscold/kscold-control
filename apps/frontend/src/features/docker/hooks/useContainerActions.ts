import { useState } from 'react';
import { dockerService } from '../../../services/api/docker.service';
import { useModalStore } from '../../../stores/modal.store';

/**
 * useContainerActions Hook
 * Handles container actions (start, stop, delete)
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

  const deleteContainer = (id: string) => {
    showConfirm(
      '정말 삭제하시겠습니까?',
      async () => {
        try {
          setLoading(true);
          await dockerService.deleteContainer(id);
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

  return {
    startContainer,
    stopContainer,
    deleteContainer,
    loading,
  };
}
