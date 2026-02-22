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
 * Manages container creation via docker-compose integration
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
      showAlert('인스턴스 이름을 입력하세요');
      return;
    }

    try {
      setIsCreating(true);

      // Use compose service for creation (adds to docker-compose.yml + starts)
      await dockerService.createComposeService({
        name: config.name,
        image: config.image,
        ports: {
          '22': config.sshPort,
          '8080': config.httpPort,
        },
        cpus: String(config.cpus),
        memLimit: config.memory,
        command: 'sleep infinity',
      });

      closeModal();
      onSuccess?.();
    } catch (error: any) {
      console.error('Failed to create instance:', error);
      showAlert(
        error.response?.data?.message || '인스턴스 생성에 실패했습니다.',
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
