import { useAuthStore } from '../stores/auth.store';
import { useModalStore } from '../stores/modal.store';

export function usePermissions() {
  const { user } = useAuthStore();
  const { showAlert } = useModalStore();

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;

    // user.permissions가 있으면 직접 사용 (로그인 응답)
    // 없으면 roles에서 추출 (기존 호환성)
    const permissions =
      user.permissions ||
      (user.roles as any).flatMap?.(
        (role: any) => role.permissions?.map((p: any) => p.name) || [],
      ) ||
      [];

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
