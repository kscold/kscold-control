import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/shared/api';
import { LOCAL_TARGET, type Target } from './target-model';

// 켜지는 데 보통 1분 안팎이라 5초 간격으로 2분까지 확인함.
const WAKE_POLL_MS = 5_000;
const WAKE_LIMIT_MS = 120_000;

const path = (id: string) =>
  `/remote-desktop/targets/${encodeURIComponent(id)}`;

// 신호를 보내는 중이면 seconds 가 null, 보낸 뒤 켜지기를 기다리는 동안 경과 초
export type WakeState = { seconds: number | null };

export function wakeLabel(state: WakeState) {
  return state.seconds === null
    ? '깨우는 중'
    : `켜지기를 기다리는 중 · ${state.seconds}초`;
}

export function useRemoteTargets() {
  const [targets, setTargets] = useState<Target[]>([LOCAL_TARGET]);
  const [online, setOnline] = useState<Record<string, boolean>>({});
  const [waking, setWaking] = useState<Record<string, WakeState>>({});
  const [error, setError] = useState('');
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending) clearTimeout(timer);
    };
  }, []);

  const probe = useCallback(async (id: string) => {
    try {
      const { data } = await api.get<{ online: boolean }>(
        `${path(id)}/status`,
        { timeout: 10_000 },
      );
      setOnline((current) => ({ ...current, [id]: data.online }));
      return data.online;
    } catch {
      return false;
    }
  }, []);

  const load = useCallback(async () => {
    const { data } = await api.get<Target[]>('/remote-desktop/targets', {
      timeout: 10_000,
    });
    setTargets(data.length ? data : [LOCAL_TARGET]);
    return data;
  }, []);

  useEffect(() => {
    let active = true;
    load()
      .then((data) => {
        if (active) for (const target of data) void probe(target.id);
      })
      .catch(() => {
        if (active) setError('저장된 원격 대상 목록을 불러오지 못했습니다.');
      });
    return () => {
      active = false;
    };
  }, [load, probe]);

  const stopWaking = (id: string) => setWaking(({ [id]: _, ...rest }) => rest);

  async function wake(target: Target) {
    setError('');
    setWaking((current) => ({ ...current, [target.id]: { seconds: null } }));
    try {
      await api.post(`${path(target.id)}/wake`, undefined, {
        timeout: 10_000,
      });
    } catch {
      stopWaking(target.id);
      setError('깨우기 신호를 보내지 못했습니다. 잠시 뒤 다시 시도하세요.');
      return;
    }
    const started = Date.now();
    const poll = async () => {
      if (await probe(target.id)) {
        stopWaking(target.id);
        return;
      }
      const elapsed = Date.now() - started;
      if (elapsed >= WAKE_LIMIT_MS) {
        stopWaking(target.id);
        setError(
          `${target.name}이(가) 2분 안에 켜지지 않았습니다. 전원과 네트워크 깨우기 설정을 확인하세요.`,
        );
        return;
      }
      setWaking((current) => ({
        ...current,
        [target.id]: { seconds: Math.round(elapsed / 1000) },
      }));
      const timer = setTimeout(() => {
        timers.current.delete(timer);
        void poll();
      }, WAKE_POLL_MS);
      timers.current.add(timer);
    };
    await poll();
  }

  async function save(id: string | undefined, payload: object) {
    const { data } = id
      ? await api.put<{ id: string }>(path(id), payload, { timeout: 10_000 })
      : await api.post<{ id: string }>('/remote-desktop/targets', payload, {
          timeout: 10_000,
        });
    const list = await load();
    const savedId = data?.id ?? id;
    if (savedId) void probe(savedId);
    return list.find((target) => target.id === savedId);
  }

  async function remove(id: string) {
    await api.delete(path(id));
    await load();
  }

  return {
    targets,
    online,
    waking,
    error,
    setError,
    wake,
    save,
    remove,
  };
}
