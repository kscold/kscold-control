/**
 * API Types
 * Request/Response types for API calls
 */

import {
  User,
  Role,
  Permission,
  Container,
  CreateContainerConfig,
  SystemInfo,
  LogType,
} from './domain.types';

// ============= Auth API Types =============

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: User;
}

export interface RegisterRequest {
  email: string;
  password: string;
  role?: string;
}

export interface MeResponse {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
}

// ============= RBAC API Types =============

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
  limit: number; // -1 = unlimited
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

// ============= Docker API Types =============

export interface CreateContainerRequest {
  name: string;
  image: string;
  ports: Record<string, number>;
  resources: {
    cpus: number;
    memory: string;
  };
  environment?: Record<string, string>;
}

export interface ContainerStatsResponse {
  cpuUsage: number;
  memoryUsage: number;
  networkIn: number;
  networkOut: number;
}

// ============= Logs API Types =============

export interface GetLogsRequest {
  logType: LogType;
  lines?: number;
  containerId?: string;
}

export interface GetLogsResponse {
  logs: string[];
}

export interface GetDockerContainerLogsResponse {
  containers: Array<{
    id: string;
    name: string;
  }>;
}

// ============= System API Types =============

export interface SystemInfoResponse extends SystemInfo {}

// ============= Common API Types =============

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}

export interface ApiSuccess<T = any> {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
}
