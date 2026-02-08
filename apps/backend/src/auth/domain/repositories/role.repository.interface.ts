import { Role } from '../../../entities/role.entity';

export interface IRoleRepository {
  findByName(name: string): Promise<Role | null>;
  create(roleData: Partial<Role>): Role;
  save(role: Role): Promise<Role>;
}

export const ROLE_REPOSITORY = Symbol('ROLE_REPOSITORY');
