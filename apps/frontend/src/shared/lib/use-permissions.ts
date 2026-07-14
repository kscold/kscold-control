import { useAuthStore } from '../model/auth.store';
import { useModalStore } from '../model/modal.store';

export function usePermissions() {
  const { user } = useAuthStore();
  const { showAlert } = useModalStore();

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;

    const permissions = user.permissions ?? [];

    return permissions.includes(permission);
  };

  const checkPermission = (permission: string, action?: () => void): void => {
    if (hasPermission(permission)) {
      action?.();
    } else {
      showAlert(
        '권한이 없습니다.\n관리자에게 문의하여 권한을 요청하세요.',
        '권한 없음',
      );
    }
  };

  return { hasPermission, checkPermission };
}
