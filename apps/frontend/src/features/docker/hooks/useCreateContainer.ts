import { useState } from 'react';
import { dockerService } from '../../../services/api/docker.service';
import { useModalStore } from '../../../stores/modal.store';

interface ContainerConfig {
  name: string;
  image: string;
  cpus: number;
  memory: string;
  sshPort: number;
  httpPort: number;
}

const DEFAULT_CONFIG: ContainerConfig = {
  name: '',
  image: 'ubuntu:22.04',
  cpus: 2,
  memory: '4g',
  sshPort: 2222,
  httpPort: 8001,
};

/**
 * useCreateContainer Hook
 * Manages container creation logic
 */
export function useCreateContainer(
  containerCount: number,
  onSuccess?: () => void,
) {
  const [isCreating, setIsCreating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [config, setConfig] = useState<ContainerConfig>(DEFAULT_CONFIG);
  const { showAlert } = useModalStore();

  const openModal = () => {
    // Generate unique name and ports
    setConfig({
      ...DEFAULT_CONFIG,
      name: `ubuntu-${Date.now()}`,
      sshPort: 2222 + containerCount,
      httpPort: 8001 + containerCount,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setConfig(DEFAULT_CONFIG);
  };

  const updateConfig = (updates: Partial<ContainerConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  };

  const createContainer = async () => {
    if (!config.name) {
      showAlert('컨테이너 이름을 입력하세요');
      return;
    }

    try {
      setIsCreating(true);
      await dockerService.createContainer({
        name: config.name,
        image: config.image,
        ports: {
          '22/tcp': config.sshPort,
          '80/tcp': config.httpPort,
        },
        resources: {
          cpus: config.cpus,
          memory: config.memory,
        },
      });

      closeModal();
      onSuccess?.();
    } catch (error: any) {
      console.error('Failed to create container:', error);
      showAlert(
        error.response?.data?.message || '컨테이너 생성에 실패했습니다.',
      );
    } finally {
      setIsCreating(false);
    }
  };

  return {
    showModal,
    config,
    isCreating,
    openModal,
    closeModal,
    updateConfig,
    createContainer,
  };
}
