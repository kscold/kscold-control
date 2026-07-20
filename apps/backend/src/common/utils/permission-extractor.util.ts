import { Role } from '../../rbac/domain/entities/role.entity';

/**
 * 권한 추출 유틸리티
 * 사용자 역할에서 권한을 뽑아내는 로직을 한곳에 모은다.
 *
 * 사용처:
 * - jwt.strategy.ts (JWT 페이로드 생성)
 * - claude.gateway.ts (WebSocket 인증)
 * - auth.controller.ts (/auth/me 엔드포인트)
 */
export class PermissionExtractor {
  /**
   * 사용자 역할에 속한 모든 권한 이름을 추출한다.
   * @param roles 사용자 역할 목록
   * @returns 중복이 제거된 평탄화된 권한 이름 배열
   */
  static extractFromRoles(roles: Role[]): string[] {
    if (!roles || roles.length === 0) {
      return [];
    }

    const permissions = roles.flatMap(
      (role) => role.permissions?.map((p) => p.name) || [],
    );

    // 중복 제거
    return [...new Set(permissions)];
  }

  /**
   * 사용자가 특정 권한을 가지고 있는지 확인한다.
   * @param roles 사용자 역할 목록
   * @param permissionName 확인할 권한
   * @returns 해당 권한을 가지고 있으면 true
   */
  static hasPermission(roles: Role[], permissionName: string): boolean {
    const permissions = this.extractFromRoles(roles);
    return permissions.includes(permissionName);
  }

  /**
   * 사용자가 지정된 권한 중 하나라도 가지고 있는지 확인한다.
   * @param roles 사용자 역할 목록
   * @param permissionNames 확인할 권한 목록
   * @returns 최소 하나 이상 가지고 있으면 true
   */
  static hasAnyPermission(roles: Role[], permissionNames: string[]): boolean {
    const permissions = this.extractFromRoles(roles);
    return permissionNames.some((p) => permissions.includes(p));
  }

  /**
   * 사용자가 지정된 권한을 모두 가지고 있는지 확인한다.
   * @param roles 사용자 역할 목록
   * @param permissionNames 확인할 권한 목록
   * @returns 모두 가지고 있으면 true
   */
  static hasAllPermissions(roles: Role[], permissionNames: string[]): boolean {
    const permissions = this.extractFromRoles(roles);
    return permissionNames.every((p) => permissions.includes(p));
  }
}
