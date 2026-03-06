/**
 * Permission name constants
 * Single source of truth for all permission strings used across the application.
 * Use these instead of hard-coding strings to prevent typos and ease refactoring.
 */
export const PERMISSIONS = {
  // Claude
  CLAUDE_EXECUTE: 'claude:execute',

  // Docker
  DOCKER_READ: 'docker:read',
  DOCKER_READ_ALL: 'docker:read-all',
  DOCKER_CREATE: 'docker:create',
  DOCKER_UPDATE: 'docker:update',
  DOCKER_DELETE: 'docker:delete',

  // Session
  SESSION_READ: 'session:read',
  SESSION_WRITE: 'session:write',

  // User management
  USER_MANAGE: 'user:manage',

  // System (network / UPnP / Nginx)
  SYSTEM_READ: 'system:read',
  SYSTEM_WRITE: 'system:write',

  // Terminal
  TERMINAL_ACCESS: 'terminal:access',

  // RBAC
  RBAC_MANAGE: 'rbac:manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
