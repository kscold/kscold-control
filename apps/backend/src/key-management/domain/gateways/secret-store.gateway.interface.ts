export interface SecretStoreVersion {
  version: string;
  payload: string;
  createdAt: string | null;
}

export interface AddedSecretVersion {
  version: string;
  createdAt: string | null;
}

export interface ISecretStoreGateway {
  readLatest(targetId: string): Promise<SecretStoreVersion>;
  readVersion(targetId: string, version: string): Promise<SecretStoreVersion>;
  addVersion(
    targetId: string,
    payload: string,
    expectedVersion: string,
  ): Promise<AddedSecretVersion>;
}

export const SECRET_STORE_GATEWAY = Symbol('SECRET_STORE_GATEWAY');
