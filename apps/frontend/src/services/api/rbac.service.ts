import { api } from '../../lib/api';
import { BaseApiService } from './base.service';
import {
  User,
  Role,
  Permission,
  CreateUserRequest,
  UpdateUserRequest,
  AssignRolesRequest,
  UpdateTerminalLimitRequest,
  CreateRoleRequest,
  UpdateRoleRequest,
} from '../../types';

/**
 * RBAC API Service
 * Centralizes all RBAC-related API calls
 *
 * Replaces direct API calls in:
 * - RbacDashboard.tsx
 */
export class RbacService extends BaseApiService {
  private readonly basePath = '/rbac';

  // ========== User Management ==========

  /**
   * Get all users with their roles
   * @returns List of users
   */
  async getUsers(): Promise<User[]> {
    try {
      const { data } = await api.get<User[]>(`${this.basePath}/users`);
      return data;
    } catch (error) {
      this.logError('RbacService', 'getUsers', error);
      this.handleError(error, 'Failed to load users');
    }
  }

  /**
   * Create a new user
   * @param request User creation data
   * @returns Created user
   */
  async createUser(request: CreateUserRequest): Promise<User> {
    try {
      const { data } = await api.post<User>(`${this.basePath}/users`, request);
      return data;
    } catch (error) {
      this.logError('RbacService', 'createUser', error);
      this.handleError(error, 'Failed to create user');
    }
  }

  /**
   * Update user details
   * @param id User ID
   * @param request Update data
   * @returns Updated user
   */
  async updateUser(id: string, request: UpdateUserRequest): Promise<User> {
    try {
      const { data } = await api.put<User>(
        `${this.basePath}/users/${id}`,
        request,
      );
      return data;
    } catch (error) {
      this.logError('RbacService', 'updateUser', error);
      this.handleError(error, 'Failed to update user');
    }
  }

  /**
   * Delete a user
   * @param id User ID
   */
  async deleteUser(id: string): Promise<void> {
    try {
      await api.delete(`${this.basePath}/users/${id}`);
    } catch (error) {
      this.logError('RbacService', 'deleteUser', error);
      this.handleError(error, 'Failed to delete user');
    }
  }

  /**
   * Assign roles to a user
   * @param userId User ID
   * @param request Role assignment data
   * @returns Updated user
   */
  async assignRoles(
    userId: string,
    request: AssignRolesRequest,
  ): Promise<User> {
    try {
      const { data } = await api.post<User>(
        `${this.basePath}/users/${userId}/roles`,
        request,
      );
      return data;
    } catch (error) {
      this.logError('RbacService', 'assignRoles', error);
      this.handleError(error, 'Failed to assign roles');
    }
  }

  /**
   * Update terminal command limit for a user
   * @param userId User ID
   * @param request Terminal limit data
   * @returns Updated user
   */
  async updateTerminalLimit(
    userId: string,
    request: UpdateTerminalLimitRequest,
  ): Promise<User> {
    try {
      const { data } = await api.put<User>(
        `${this.basePath}/users/${userId}/terminal-limit`,
        request,
      );
      return data;
    } catch (error) {
      this.logError('RbacService', 'updateTerminalLimit', error);
      this.handleError(error, 'Failed to update terminal limit');
    }
  }

  /**
   * Reset terminal command count for a user
   * @param userId User ID
   */
  async resetTerminalCommandCount(userId: string): Promise<void> {
    try {
      await api.post(`${this.basePath}/users/${userId}/reset-terminal-limit`);
    } catch (error) {
      this.logError('RbacService', 'resetTerminalCommandCount', error);
      this.handleError(error, 'Failed to reset terminal command count');
    }
  }

  // ========== Role Management ==========

  /**
   * Get all roles with their permissions
   * @returns List of roles
   */
  async getRoles(): Promise<Role[]> {
    try {
      const { data } = await api.get<Role[]>(`${this.basePath}/roles`);
      return data;
    } catch (error) {
      this.logError('RbacService', 'getRoles', error);
      this.handleError(error, 'Failed to load roles');
    }
  }

  /**
   * Create a new role
   * @param request Role creation data
   * @returns Created role
   */
  async createRole(request: CreateRoleRequest): Promise<Role> {
    try {
      const { data } = await api.post<Role>(`${this.basePath}/roles`, request);
      return data;
    } catch (error) {
      this.logError('RbacService', 'createRole', error);
      this.handleError(error, 'Failed to create role');
    }
  }

  /**
   * Update role details
   * @param id Role ID
   * @param request Update data
   * @returns Updated role
   */
  async updateRole(id: string, request: UpdateRoleRequest): Promise<Role> {
    try {
      const { data } = await api.put<Role>(
        `${this.basePath}/roles/${id}`,
        request,
      );
      return data;
    } catch (error) {
      this.logError('RbacService', 'updateRole', error);
      this.handleError(error, 'Failed to update role');
    }
  }

  /**
   * Delete a role
   * @param id Role ID
   */
  async deleteRole(id: string): Promise<void> {
    try {
      await api.delete(`${this.basePath}/roles/${id}`);
    } catch (error) {
      this.logError('RbacService', 'deleteRole', error);
      this.handleError(error, 'Failed to delete role');
    }
  }

  // ========== Permission Management ==========

  /**
   * Get all available permissions
   * @returns List of permissions
   */
  async getPermissions(): Promise<Permission[]> {
    try {
      const { data } = await api.get<Permission[]>(
        `${this.basePath}/permissions`,
      );
      return data;
    } catch (error) {
      this.logError('RbacService', 'getPermissions', error);
      this.handleError(error, 'Failed to load permissions');
    }
  }
}

// Export singleton instance
export const rbacService = new RbacService();
