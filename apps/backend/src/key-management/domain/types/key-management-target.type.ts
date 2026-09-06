export type SecretStoreProvider = 'gcp-secret-manager' | 'ssh-env-file';
export type DeploymentProvider = 'github-actions' | 'ssh-blue-green';

export interface GcpSecretStoreConfig {
  projectId: string;
  secretName: string;
  serviceAccount: string;
}

export interface SshSecretStoreConfig {
  host: string;
  port: number;
  username: string;
  envPath: string;
  credentialRef: string;
}

export interface GithubActionsDeploymentConfig {
  repository: string;
  workflow: string;
  ref: string;
}

export interface SshBlueGreenDeploymentConfig {
  workingDirectory: string;
  script: string;
  statusDirectory: string;
}

export interface KeyManagementTarget {
  id: string;
  displayName: string;
  description: string;
  environment: string;
  provider: SecretStoreProvider;
  deploymentProvider: DeploymentProvider;
  envFileName: string;
  instanceName: string;
  location: string;
  requiredKeys: string[];
  secretConfig: GcpSecretStoreConfig | SshSecretStoreConfig;
  deploymentConfig:
    GithubActionsDeploymentConfig | SshBlueGreenDeploymentConfig;
  enabled: boolean;
  sortOrder: number;
}
