import { ROLES } from '../constants/roles';

/**
 * Legacy `admin` users retain the same global operational scope as
 * `super_admin` users while existing role assignments are migrated.
 */
export function isGlobalAdministrator(
  roles: readonly string[] | null | undefined,
): boolean {
  return Boolean(
    roles?.some((role) => role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN),
  );
}
