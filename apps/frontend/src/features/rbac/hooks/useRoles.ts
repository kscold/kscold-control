import { useState, useEffect } from 'react';
import { rbacService } from '../../../services/api/rbac.service';
import type { Role, Permission } from '../../../types/domain.types';

/**
 * useRoles Hook
 * Fetches and manages roles and permissions state
 */
export function useRoles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRoles = async () => {
    try {
      setError(null);
      const data = await rbacService.getRoles();
      setRoles(data);
    } catch (err) {
      console.error('Failed to load roles:', err);
      setError('역할 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const loadPermissions = async () => {
    try {
      const data = await rbacService.getPermissions();
      setPermissions(data);
    } catch (err) {
      console.error('Failed to load permissions:', err);
    }
  };

  useEffect(() => {
    Promise.all([loadRoles(), loadPermissions()]);
  }, []);

  return {
    roles,
    permissions,
    loading,
    error,
    reload: loadRoles,
  };
}
