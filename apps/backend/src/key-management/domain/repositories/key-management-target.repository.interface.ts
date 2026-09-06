import { KeyManagementTargetEntity } from '../entities/key-management-target.entity';

export interface IKeyManagementTargetRepository {
  findEnabled(): Promise<KeyManagementTargetEntity[]>;
  findEnabledById(id: string): Promise<KeyManagementTargetEntity | null>;
}

export const KEY_MANAGEMENT_TARGET_REPOSITORY = Symbol(
  'KEY_MANAGEMENT_TARGET_REPOSITORY',
);
