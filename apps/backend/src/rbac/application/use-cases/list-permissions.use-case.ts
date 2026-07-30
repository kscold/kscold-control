import { Injectable, Inject } from '@nestjs/common';
import {
  IPermissionRepository,
  PERMISSION_REPOSITORY,
} from '../../domain/repositories/permission.repository.interface';
import { PermissionResponseDto } from '../dto/permission-response.dto';

/**
 * 권한 목록 조회 유스케이스
 *
 * 역할에 부여할 수 있는 전체 권한을 조회한다.
 * 목록은 코드 상수가 아니라 DB(permissions 테이블)에서 읽으므로
 * 권한이 추가돼도 이 코드를 고칠 필요가 없다.
 */
@Injectable()
export class ListPermissionsUseCase {
  constructor(
    @Inject(PERMISSION_REPOSITORY)
    private readonly permissionRepository: IPermissionRepository,
  ) {}

  async execute(): Promise<PermissionResponseDto[]> {
    const permissions = await this.permissionRepository.findAll();
    return permissions.map((permission) =>
      PermissionResponseDto.fromEntity(permission),
    );
  }
}
