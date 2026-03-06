/**
 * Role name constants
 * Use instead of hardcoded role name strings.
 */
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  READ_ONLY: 'read_only',
  OPERATOR: 'operator',
  TERMINAL_ONLY: 'terminal_only',
  GUEST: 'guest',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];
