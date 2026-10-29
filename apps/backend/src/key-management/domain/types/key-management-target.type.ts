export type SecretStoreProvider =
  'gcp-secret-manager' | 'ssh-env-file' | 'ssh-env-command';
export type DeploymentProvider =
  'github-actions' | 'ssh-blue-green' | 'ssh-env-command';

export interface GcpSecretStoreConfig {
  projectId: string;
  secretName: string;
  serviceAccount: string;
}

export interface SshConnectionConfig {
  host: string;
  port: number;
  username: string;
  credentialRef: string;
}

export interface SshSecretStoreConfig extends SshConnectionConfig {
  envPath: string;
}

export interface SshEnvCommandSecretStoreConfig extends SshConnectionConfig {
  protocol: 'env-v1';
  allowedKeys: string[];
}

export interface SshEnvCommandDeploymentConfig {
  protocol: 'env-v1';
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
  secretConfig:
    | GcpSecretStoreConfig
    | SshSecretStoreConfig
    | SshEnvCommandSecretStoreConfig;
  deploymentConfig:
    | GithubActionsDeploymentConfig
    | SshBlueGreenDeploymentConfig
    | SshEnvCommandDeploymentConfig;
  enabled: boolean;
  sortOrder: number;
}
