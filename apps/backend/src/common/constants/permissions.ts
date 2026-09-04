/**
 * 권한 이름 상수
 * 애플리케이션 전체에서 쓰는 권한 문자열의 단일 기준점이다.
 * 문자열을 직접 적지 말고 이 상수를 쓰면 오타를 막고 이름 변경도 쉬워진다.
 */
export const PERMISSIONS = {
  // Dashboard (운영 요약 조회)
  DASHBOARD_READ: 'dashboard:read',

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

  // User (사용자 관리)
  USER_MANAGE: 'user:manage',

  // System (네트워크 / UPnP / Nginx)
  SYSTEM_READ: 'system:read',
  SYSTEM_WRITE: 'system:write',

  // Terminal
  TERMINAL_ACCESS: 'terminal:access',

  // RBAC
  RBAC_MANAGE: 'rbac:manage',

  // Repository (소스 저장소)
  REPOSITORY_READ: 'repository:read',
  REPOSITORY_WRITE: 'repository:write',
  REPOSITORY_DELETE: 'repository:delete',

  // Security (IP 차단)
  SECURITY_READ: 'security:read',
  SECURITY_MANAGE: 'security:manage',

  // Secrets (운영 환경 변수)
  SECRETS_READ: 'secrets:read',
  SECRETS_REVEAL: 'secrets:reveal',
  SECRETS_WRITE: 'secrets:write',
  SECRETS_DEPLOY: 'secrets:deploy',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
