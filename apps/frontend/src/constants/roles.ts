/**
 * Role name constants - mirrors backend ROLES
 * Use instead of hardcoded role name strings in UI components.
 */
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  READ_ONLY: 'read_only',
  OPERATOR: 'operator',
  TERMINAL_ONLY: 'terminal_only',
  GUEST: 'guest',
} as const;
