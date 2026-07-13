import { useCallback, useEffect, useState } from 'react';
import { securityService } from '../api/security.service';
import type { CreateIpBanInput, IpBan } from '../lib/security.types';

export function useIpBans() {
  const [bans, setBans] = useState<IpBan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await securityService.listBans();
      setBans(items);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const create = useCallback(
    async (input: CreateIpBanInput) => {
      const ban = await securityService.createBan(input);
      await load();
      return ban;
    },
    [load],
  );

  const remove = useCallback(
    async (id: string) => {
      await securityService.removeBan(id);
      await load();
    },
    [load],
  );

  const resync = useCallback(async () => {
    const result = await securityService.resync();
    await load();
    return result;
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  return { bans, loading, error, reload: load, create, remove, resync };
}
