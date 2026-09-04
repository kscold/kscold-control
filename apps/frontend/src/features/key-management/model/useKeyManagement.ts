import { startTransition, useEffect, useState } from 'react';
import { keyManagementService } from '../api/key-management.service';
import type {
  KeyManagementTarget,
  RevealedEnvironment,
  SecretBackup,
} from './types';

export function useKeyManagement() {
  const [targets, setTargets] = useState<KeyManagementTarget[]>([]);
  const [backups, setBackups] = useState<SecretBackup[]>([]);
  const [revealed, setRevealed] = useState<RevealedEnvironment | null>(null);
  const [editorValue, setEditorValue] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const target = targets[0] ?? null;

  const clearReveal = () => {
    setRevealed(null);
    setEditorValue('');
  };

  const load = async (quiet = false) => {
    if (!quiet) setIsLoading(true);
    setError(null);
    try {
      const nextTargets = await keyManagementService.getTargets();
      const nextTarget = nextTargets[0];
      const nextBackups = nextTarget
        ? await keyManagementService.getBackups(nextTarget.id)
        : [];
      startTransition(() => {
        setTargets(nextTargets);
        setBackups(nextBackups);
      });
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : '운영 키 정보를 불러오지 못했습니다.',
      );
    } finally {
      if (!quiet) setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const hasActiveDeployment = backups.some((backup) =>
      ['deployment_queued', 'deployment_running'].includes(backup.status),
    );
    if (!hasActiveDeployment) return;

    const timer = window.setInterval(() => void load(true), 5_000);
    return () => window.clearInterval(timer);
  }, [backups]);

  useEffect(() => {
    if (!revealed) return;
    const remaining = new Date(revealed.expiresAt).getTime() - Date.now();
    const timer = window.setTimeout(clearReveal, Math.max(remaining, 0));
    return () => window.clearTimeout(timer);
  }, [revealed]);

  const reveal = async () => {
    if (!target) return;
    setIsWorking(true);
    setError(null);
    try {
      const result = await keyManagementService.reveal(target.id);
      setRevealed(result);
      setEditorValue(result.envFile);
    } catch (revealError) {
      setError(
        revealError instanceof Error
          ? revealError.message
          : '운영 환경 변수를 공개하지 못했습니다.',
      );
    } finally {
      setIsWorking(false);
    }
  };

  const save = async () => {
    if (!target || !revealed) return;
    setIsWorking(true);
    setError(null);
    try {
      const result = await keyManagementService.update(
        target.id,
        editorValue,
        revealed.version,
      );
      clearReveal();
      await load(true);
      return result;
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : '운영 환경 변수 변경에 실패했습니다.',
      );
      throw saveError;
    } finally {
      setIsWorking(false);
    }
  };

  const restore = async (backupId: string) => {
    if (!target) return;
    setIsWorking(true);
    setError(null);
    try {
      clearReveal();
      const result = await keyManagementService.restore(
        target.id,
        backupId,
        target.version,
      );
      await load(true);
      return result;
    } catch (restoreError) {
      setError(
        restoreError instanceof Error
          ? restoreError.message
          : '백업 복원에 실패했습니다.',
      );
      throw restoreError;
    } finally {
      setIsWorking(false);
    }
  };

  const retry = async (backupId: string) => {
    if (!target) return;
    setIsWorking(true);
    setError(null);
    try {
      const result = await keyManagementService.retryDeployment(
        target.id,
        backupId,
      );
      await load(true);
      return result;
    } catch (retryError) {
      setError(
        retryError instanceof Error
          ? retryError.message
          : '배포 재시도에 실패했습니다.',
      );
      throw retryError;
    } finally {
      setIsWorking(false);
    }
  };

  return {
    targets,
    target,
    backups,
    revealed,
    editorValue,
    isLoading,
    isWorking,
    error,
    setEditorValue,
    clearReveal,
    load,
    reveal,
    save,
    restore,
    retry,
  };
}
