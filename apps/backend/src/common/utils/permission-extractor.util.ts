import { Role } from '../../entities/role.entity';

/**
 * Permission extraction utility
 * Centralizes permission extraction logic from user roles
 *
 * Used in:
 * - jwt.strategy.ts (JWT payload creation)
 * - claude.gateway.ts (WebSocket authentication)
 * - auth.controller.ts (/auth/me endpoint)
 */
export class PermissionExtractor {
  /**
   * Extract all permission names from user roles
   * @param roles Array of user roles
   * @returns Flat array of unique permission names
   */
  static extractFromRoles(roles: Role[]): string[] {
    if (!roles || roles.length === 0) {
      return [];
    }

    const permissions = roles.flatMap(
      (role) => role.permissions?.map((p) => p.name) || [],
    );

    // Remove duplicates
    return [...new Set(permissions)];
  }

  /**
   * Check if user has specific permission
   * @param roles Array of user roles
   * @param permissionName Permission to check
   * @returns True if user has the permission
   */
  static hasPermission(roles: Role[], permissionName: string): boolean {
    const permissions = this.extractFromRoles(roles);
    return permissions.includes(permissionName);
  }

  /**
   * Check if user has any of the specified permissions
   * @param roles Array of user roles
   * @param permissionNames Permissions to check
   * @returns True if user has at least one permission
   */
  static hasAnyPermission(roles: Role[], permissionNames: string[]): boolean {
    const permissions = this.extractFromRoles(roles);
    return permissionNames.some((p) => permissions.includes(p));
  }

  /**
   * Check if user has all specified permissions
   * @param roles Array of user roles
   * @param permissionNames Permissions to check
   * @returns True if user has all permissions
   */
  static hasAllPermissions(roles: Role[], permissionNames: string[]): boolean {
    const permissions = this.extractFromRoles(roles);
    return permissionNames.every((p) => permissions.includes(p));
  }
}
