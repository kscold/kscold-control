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

export interface CreateRoleRequest {
  name: string;
  description?: string;
  permissionIds: string[];
}

export interface UpdateRoleRequest {
  name?: string;
  description?: string;
  permissionIds?: string[];
}
