import { useCallback, useEffect, useState } from 'react';
import { repositoryService } from '@/entities/project';
import type {
  RepositoryProject,
  CreateProjectInput,
} from '@/entities/project';

export function useProjects() {
  const [projects, setProjects] = useState<RepositoryProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const items = await repositoryService.listProjects();
      setProjects(items);
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장소 목록 조회 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(
    async (input: CreateProjectInput) => {
      const project = await repositoryService.createProject(input);
      await load();
      return project;
    },
    [load],
  );

  const remove = useCallback(
    async (id: string) => {
      await repositoryService.deleteProject(id);
      await load();
    },
    [load],
  );

  return { projects, loading, error, reload: load, create, remove };
}
