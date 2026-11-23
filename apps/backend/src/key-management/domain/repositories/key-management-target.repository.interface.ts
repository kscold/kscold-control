import { KeyManagementTargetEntity } from '../entities/key-management-target.entity';

export interface IKeyManagementTargetRepository {
  findEnabled(): Promise<KeyManagementTargetEntity[]>;
  findEnabledById(id: string): Promise<KeyManagementTargetEntity | null>;
  /** 꺼진 대상까지 포함해 같은 ID 가 있는지 */
  exists(id: string): Promise<boolean>;
  create(
    target: Omit<KeyManagementTargetEntity, 'createdAt' | 'updatedAt'>,
  ): Promise<void>;
  /** 대상을 끈다. 백업 기록이 남아 있어 행은 지우지 않는다. 바꾼 행이 없으면 false */
  disable(id: string): Promise<boolean>;
}

export const KEY_MANAGEMENT_TARGET_REPOSITORY = Symbol(
  'KEY_MANAGEMENT_TARGET_REPOSITORY',
);
