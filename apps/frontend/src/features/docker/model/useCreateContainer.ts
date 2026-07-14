import { useState } from 'react';
import { dockerService } from '@/entities/container';
import { useModalStore } from '@/shared/model';

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
  sshPort: 2227,
  httpPort: 8085,
};

/**
 * useCreateContainer Hook
 * Manages container creation via docker-compose integration
 */
export function useCreateContainer(onSuccess?: () => void) {
  const [isCreating, setIsCreating] = useState(false);
  const [isPreparingTemplate, setIsPreparingTemplate] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [config, setConfig] = useState<ContainerConfig>(DEFAULT_CONFIG);
  const [templateWarning, setTemplateWarning] = useState<string | null>(null);
  const { showAlert } = useModalStore();

  const openModal = async () => {
    setShowModal(true);
    setIsPreparingTemplate(true);
    setTemplateWarning(null);

    try {
      const template = await dockerService.getComposeProvisioningTemplate();
      setConfig({
        name: template.name,
        image: template.image,
        cpus: Number.parseInt(template.cpus, 10),
        memory: template.memLimit,
        sshPort: template.ports['22'],
        httpPort: template.ports['8080'],
      });
    } catch (error) {
      console.error('Failed to load compose provisioning template:', error);
      setConfig(DEFAULT_CONFIG);
      setTemplateWarning(
        '기본 포트를 직접 입력해야 합니다. 최근 사용 포트를 다시 확인해 주세요.',
      );
    } finally {
      setIsPreparingTemplate(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setConfig(DEFAULT_CONFIG);
    setTemplateWarning(null);
    setIsPreparingTemplate(false);
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
    isPreparingTemplate,
    templateWarning,
    openModal,
    closeModal,
    updateConfig,
    createContainer,
  };
}
