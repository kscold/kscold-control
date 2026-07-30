import { useState } from 'react';
import { logsService } from '../api/logs.service';
import type { DockerContainer } from './logs.types';

/**
 * 인프라 컨테이너를 앞에 두고 같은 역할끼리는 이름순으로 정렬한다.
 *
 * 과거에는 컨테이너 이름을 하드코딩한 목록으로 순서를 정했는데,
 * 제거된 컨테이너(galjido)가 남고 신규 컨테이너는 빠져 목록이 낡아 있었다.
 * 역할 분류는 서버가 내려주므로 컨테이너가 바뀌어도 이 코드는 그대로 둔다.
 */
function compareByRoleThenName(
  left: DockerContainer,
  right: DockerContainer,
): number {
  const rank = (container: DockerContainer) =>
    container.role === 'infra' ? 0 : 1;
  const diff = rank(left) - rank(right);
  return diff !== 0 ? diff : left.name.localeCompare(right.name);
}

export function useDockerContainers() {
  const [dockerContainers, setDockerContainers] = useState<DockerContainer[]>(
    [],
  );
  const [selectedContainer, setSelectedContainer] = useState<string>('');

  const loadDockerContainers = async () => {
    try {
      const containers = await logsService.listDockerContainers();
      const sorted = [...containers].sort(compareByRoleThenName);

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
