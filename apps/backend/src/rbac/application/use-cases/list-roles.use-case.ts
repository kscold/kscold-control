import { Injectable, Inject } from '@nestjs/common';
import {
  IRoleRepository,
  ROLE_REPOSITORY,
} from '../../domain/repositories/role.repository.interface';
import { RoleResponseDto } from '../dto/role-response.dto';

/**
 * List Roles Use Case
 * Business logic for retrieving all roles with permissions
 */
@Injectable()
export class ListRolesUseCase {
  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: IRoleRepository,
  ) {}

  async execute(): Promise<RoleResponseDto[]> {
    const roles = await this.roleRepository.findAllWithPermissions();
    return RoleResponseDto.fromEntities(roles, true);
  }
}
