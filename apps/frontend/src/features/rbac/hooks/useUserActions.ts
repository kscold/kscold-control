import { useState } from 'react';
import { rbacService } from '../../../services/api/rbac.service';
import { useModalStore } from '../../../stores/modal.store';

/**
 * useUserActions Hook
 * Handles all user-related actions (CRUD, roles, terminal limits)
 */
export function useUserActions(onSuccess?: () => void) {
  const [loading, setLoading] = useState(false);
  const { showAlert, showConfirm } = useModalStore();

  const createUser = async (email: string, password: string) => {
    if (!email || !password) {
      showAlert('이메일과 비밀번호를 입력하세요');
      return false;
    }

    try {
      setLoading(true);
      await rbacService.createUser({ email, password });
      onSuccess?.();
      return true;
    } catch (error: any) {
      console.error('Failed to create user:', error);
      showAlert(error.response?.data?.message || '사용자 생성 실패');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const updatePassword = async (userId: string, password: string) => {
    if (!password) {
      showAlert('새 비밀번호를 입력하세요');
      return false;
    }

    try {
      setLoading(true);
      await rbacService.updateUser(userId, { password });
      showAlert('비밀번호가 변경되었습니다');
      onSuccess?.();
      return true;
    } catch (error) {
      console.error('Failed to update password:', error);
      showAlert('비밀번호 변경 실패');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = (userId: string, userEmail: string) => {
    showConfirm(
      `정말 ${userEmail} 사용자를 삭제하시겠습니까?`,
      async () => {
        try {
          setLoading(true);
          await rbacService.deleteUser(userId);
          onSuccess?.();
        } catch (error) {
          console.error('Failed to delete user:', error);
          showAlert('사용자 삭제 실패');
        } finally {
          setLoading(false);
        }
      },
      '사용자 삭제',
    );
  };

  const assignRoles = async (userId: string, roleIds: string[]) => {
    try {
      setLoading(true);
      await rbacService.assignRoles(userId, { roleIds });
      onSuccess?.();
      return true;
    } catch (error) {
      console.error('Failed to assign roles:', error);
      showAlert('역할 할당 실패');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const resetTerminalLimit = async (userId: string) => {
    try {
      setLoading(true);
      await rbacService.resetTerminalCommandCount(userId);
      showAlert('터미널 명령어 카운트가 리셋되었습니다');
      onSuccess?.();
    } catch (error) {
      console.error('Failed to reset terminal limit:', error);
      showAlert('터미널 제한 리셋 실패');
    } finally {
      setLoading(false);
    }
  };

  const updateTerminalLimit = async (userId: string, limit: number) => {
    try {
      setLoading(true);
      await rbacService.updateTerminalLimit(userId, { limit });
      showAlert(
        `터미널 제한이 ${limit === -1 ? '무제한' : limit + '회'}로 변경되었습니다`,
      );
      onSuccess?.();
      return true;
    } catch (error) {
      console.error('Failed to update terminal limit:', error);
      showAlert('터미널 제한 변경 실패');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    createUser,
    updatePassword,
    deleteUser,
    assignRoles,
    resetTerminalLimit,
    updateTerminalLimit,
    loading,
  };
}
