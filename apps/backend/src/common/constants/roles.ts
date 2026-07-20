/**
 * 역할 이름 상수
 * 역할 이름을 문자열로 직접 적지 말고 이 상수를 쓴다.
 */
export const ROLES = {
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
  READ_ONLY: 'read_only',
  OPERATOR: 'operator',
  TERMINAL_ONLY: 'terminal_only',
  GUEST: 'guest',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];
