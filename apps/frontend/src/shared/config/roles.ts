/**
 * 역할 이름 상수 - 백엔드의 ROLES와 동일하게 유지한다
 * UI 컴포넌트에서 역할 이름을 문자열로 하드코딩하지 말고 이 상수를 사용한다.
 */
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  READ_ONLY: 'read_only',
  OPERATOR: 'operator',
  TERMINAL_ONLY: 'terminal_only',
  GUEST: 'guest',
} as const;
