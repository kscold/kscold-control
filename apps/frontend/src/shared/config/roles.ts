/**
 * 역할 이름 상수 - 백엔드의 ROLES와 동일하게 유지한다
 * UI 컴포넌트에서 역할 이름을 문자열로 하드코딩하지 말고 이 상수를 사용한다.
 */
export const ROLES = {
  /**
   * 레거시 최고 관리자 역할.
   * 백엔드가 super_admin 과 동일한 전역 권한으로 취급하므로(role-access.util.ts)
   * 화면에서도 같은 등급으로 다뤄야 한다.
   */
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
  READ_ONLY: 'read_only',
  OPERATOR: 'operator',
  TERMINAL_ONLY: 'terminal_only',
  GUEST: 'guest',
  PENDING_APPROVAL: 'pending_approval',
  KEY_MANAGER: 'key_manager',
} as const;
