import { useCallback, useEffect, useState } from 'react';
import { repositoryService } from '../../../services/api/repository.service';
import type { FileTreeNode, FileContentResult } from '../lib/repository.types';

export function useProjectTree(projectId: string | null) {
  const [tree, setTree] = useState<FileTreeNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!projectId) {
      setTree(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await repositoryService.getTree(projectId);
      setTree(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '트리 조회 실패');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  return { tree, loading, error, reload: load };
}

export function useFileContent(projectId: string | null, path: string | null) {
  const [content, setContent] = useState<FileContentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId || !path) {
      setContent(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    repositoryService
      .readFile(projectId, path)
      .then((data) => {
        if (!cancelled) setContent(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '파일 조회 실패');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, path]);

  return { content, loading, error };
}
