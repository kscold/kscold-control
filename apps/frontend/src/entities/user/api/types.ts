// RBAC API 요청 타입

export interface CreateUserRequest {
  email: string;
  password: string;
  roleIds?: string[];
}

export interface UpdateUserRequest {
  email?: string;
  password?: string;
}

export interface AssignRolesRequest {
  roleIds: string[];
}

export interface UpdateTerminalLimitRequest {
  limit: number; // -1이면 무제한
}

export interface KeyManagementAccessTarget {
  id: string;
  displayName: string;
  environment: string;
}

export interface KeyManagementTargetAssignment {
  userId: string;
  targetIds: string[];
}

export interface KeyManagementAccessMatrix {
  targets: KeyManagementAccessTarget[];
  assignments: KeyManagementTargetAssignment[];
}

export interface BackupAccessTarget {
  id: string;
  name: string;
  description: string;
}

export interface BackupTargetAssignment {
  userId: string;
  targetIds: string[];
}

export interface BackupAccessMatrix {
  targets: BackupAccessTarget[];
  assignments: BackupTargetAssignment[];
}

export interface ImpersonationResponse {
  accessToken: string;
  sessionId: string;
  expiresAt: string;
  readOnly: true;
  user: {
    id: string;
    email: string;
    roles: string[];
    permissions: string[];
  };
}
