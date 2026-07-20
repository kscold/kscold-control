import { ROLES } from '../constants/roles';

type RoleReference = string | { name: string };

/**
 * 기존 역할 배정을 이전하는 동안, 레거시 `admin` 사용자는 `super_admin`과
 * 동일한 전역 운영 권한 범위를 그대로 유지한다.
 */
export function isGlobalAdministrator(
  roles: readonly RoleReference[] | null | undefined,
): boolean {
  return Boolean(
    roles?.some((role) => {
      const name = typeof role === 'string' ? role : role.name;
      return name === ROLES.ADMIN || name === ROLES.SUPER_ADMIN;
    }),
  );
}
