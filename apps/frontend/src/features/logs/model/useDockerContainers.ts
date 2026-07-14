import { useState } from 'react';
import { api } from '@/shared/api/client';
import type { DockerContainer } from '../model/logs.types';

const PREFERRED_CONTAINER_ORDER = [
  'kscold-nginx',
  'kscold-infra-db',
  'ubuntu-blog',
  'ubuntu-slacord',
  'ubuntu-congbang',
  'ubuntu-galjido',
] as const;

export function useDockerContainers() {
  const [dockerContainers, setDockerContainers] = useState<DockerContainer[]>(
    [],
  );
  const [selectedContainer, setSelectedContainer] = useState<string>('');

  const loadDockerContainers = async () => {
    try {
      const { data } = await api.get<DockerContainer[]>(
        '/logs/docker/containers',
      );
      const sorted = [...data].sort((left, right) => {
        const leftPriority = PREFERRED_CONTAINER_ORDER.indexOf(
          left.name as (typeof PREFERRED_CONTAINER_ORDER)[number],
        );
        const rightPriority = PREFERRED_CONTAINER_ORDER.indexOf(
          right.name as (typeof PREFERRED_CONTAINER_ORDER)[number],
        );

        if (leftPriority !== -1 || rightPriority !== -1) {
          if (leftPriority === -1) return 1;
          if (rightPriority === -1) return -1;
          return leftPriority - rightPriority;
        }

        return left.name.localeCompare(right.name);
      });

      setDockerContainers(sorted);

      const selectedStillExists = sorted.some(
        (container) => container.id === selectedContainer,
      );

      if (!selectedStillExists) {
        const preferredDefault =
          sorted.find((container) => container.name === 'kscold-nginx') ??
          sorted[0];

        if (preferredDefault) {
          setSelectedContainer(preferredDefault.id);
        }
      }
    } catch (error) {
      console.error('Failed to load docker containers:', error);
    }
  };

  return {
    dockerContainers,
    selectedContainer,
    setSelectedContainer,
    loadDockerContainers,
  };
}
