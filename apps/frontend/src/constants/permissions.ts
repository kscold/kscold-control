/**
 * Permission constants - mirrors backend PERMISSIONS
 * Use instead of hardcoded permission strings in UI components.
 */
export const PERMISSIONS = {
  CLAUDE_EXECUTE: 'claude:execute',
  DOCKER_READ: 'docker:read',
  DOCKER_READ_ALL: 'docker:read-all',
  DOCKER_CREATE: 'docker:create',
  DOCKER_UPDATE: 'docker:update',
  DOCKER_DELETE: 'docker:delete',
  SESSION_READ: 'session:read',
  SESSION_WRITE: 'session:write',
  USER_MANAGE: 'user:manage',
  SYSTEM_READ: 'system:read',
  SYSTEM_WRITE: 'system:write',
  TERMINAL_ACCESS: 'terminal:access',
  RBAC_MANAGE: 'rbac:manage',
} as const;
