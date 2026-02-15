import { Role } from '../entities/role.entity';

/**
 * Role Repository Interface
 * Domain layer abstraction for role data access
 */
export interface IRoleRepository {
  /**
   * Find role by ID
   */
  findById(id: string): Promise<Role | null>;

  /**
   * Find role by name
   */
  findByName(name: string): Promise<Role | null>;

  /**
   * Find role by name with permissions
   */
  findByNameWithPermissions(name: string): Promise<Role | null>;

  /**
   * Find all roles
   */
  findAll(): Promise<Role[]>;

  /**
   * Find all roles with permissions
   */
  findAllWithPermissions(): Promise<Role[]>;

  /**
   * Find roles by IDs
   */
  findByIds(ids: string[]): Promise<Role[]>;

  /**
   * Find roles by IDs with permissions
   */
  findByIdsWithPermissions(ids: string[]): Promise<Role[]>;

  /**
   * Create a new role
   */
  create(roleData: Partial<Role>): Role;

  /**
   * Save role (create or update)
   */
  save(role: Role): Promise<Role>;

  /**
   * Delete role by ID
   */
  delete(id: string): Promise<void>;
}

/**
 * Dependency Injection token for Role Repository
 */
export const ROLE_REPOSITORY = Symbol('ROLE_REPOSITORY');
