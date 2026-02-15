import { useState, useEffect } from 'react';
import { rbacService } from '../../../services/api/rbac.service';
import type { User } from '../../../types/domain.types';

/**
 * useUsers Hook
 * Fetches and manages users list state
 */
export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = async () => {
    try {
      setError(null);
      const data = await rbacService.getUsers();
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users:', err);
      setError('사용자 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  return {
    users,
    loading,
    error,
    reload: loadUsers,
  };
}
