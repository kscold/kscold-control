import { ROLES } from '../constants/roles';

type RoleReference = string | { name: string };

/**
 * Legacy `admin` users retain the same global operational scope as
 * `super_admin` users while existing role assignments are migrated.
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
