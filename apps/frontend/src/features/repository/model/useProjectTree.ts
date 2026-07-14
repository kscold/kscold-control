import { useCallback, useEffect, useState } from 'react';
import { repositoryService } from '@/entities/project';
import type {
  FileTreeNode,
  FileContentResult,
  VersionedFileContentResult,
} from '@/entities/project';

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
        if (!cancelled)
          setError(e instanceof Error ? e.message : '파일 조회 실패');
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

export function useLatestVersion(projectId: string | null) {
  const [latestId, setLatestId] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) {
      setLatestId(null);
      setCount(0);
      return;
    }
    setLoading(true);
    try {
      const items = await repositoryService.listVersions(projectId);
      setCount(items.length);
      setLatestId(items[0]?.id ?? null);
    } catch {
      setLatestId(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { latestId, count, loading, reload: load };
}

export function useFileAtVersion(
  projectId: string | null,
  path: string | null,
  versionId: string | null,
  enabled: boolean,
) {
  const [content, setContent] = useState<VersionedFileContentResult | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !projectId || !path || !versionId) {
      setContent(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    repositoryService
      .readFileAtVersion(projectId, path, versionId)
      .then((data) => {
        if (!cancelled) setContent(data);
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : '이전 버전 조회 실패');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, projectId, path, versionId]);

  return { content, loading, error };
}
