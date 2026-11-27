import { useState, useEffect } from 'react';
import { rbacService } from '@/entities/user';
import type { Role, Permission } from '@/entities/user';

/**
 * 역할과 권한을 조회하고 그 상태를 관리하는 훅
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
      // 권한 목록이 비면 역할 편집에서 권한을 다 뺀 것처럼 저장될 수 있다
      setError(
        '권한 목록을 불러오지 못했습니다. 역할을 고치기 전에 새로고침하세요.',
      );
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
