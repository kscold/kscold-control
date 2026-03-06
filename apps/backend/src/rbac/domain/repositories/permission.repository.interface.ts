import { Permission } from '../entities/permission.entity';

/**
 * Permission Repository Interface
 * Domain layer abstraction for permission data access
 */
export interface IPermissionRepository {
  findByName(name: string): Promise<Permission | null>;
  findAll(): Promise<Permission[]>;
  create(data: Partial<Permission>): Permission;
  save(permission: Permission): Promise<Permission>;
}

export const PERMISSION_REPOSITORY = Symbol('PERMISSION_REPOSITORY');
