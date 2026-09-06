export interface KeyManagementTargetScope {
  id: string;
  displayName: string;
  environment: string;
}

export interface KeyManagementTargetAssignment {
  userId: string;
  targetIds: string[];
}

export interface IKeyManagementTargetAccessRepository {
  findEnabledTargets(): Promise<KeyManagementTargetScope[]>;
  findTargetIdsByUserId(userId: string): Promise<string[]>;
  findAllAssignments(): Promise<KeyManagementTargetAssignment[]>;
  replaceForUser(
    userId: string,
    targetIds: string[],
    grantedById: string,
  ): Promise<void>;
}

export const KEY_MANAGEMENT_TARGET_ACCESS_REPOSITORY = Symbol(
  'KEY_MANAGEMENT_TARGET_ACCESS_REPOSITORY',
);
