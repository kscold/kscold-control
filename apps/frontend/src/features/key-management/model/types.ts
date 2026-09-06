export interface KeyManagementTarget {
  id: string;
  displayName: string;
  description: string;
  environment: string;
  provider: 'gcp-secret-manager' | 'ssh-env-file';
  deploymentProvider: 'github-actions' | 'ssh-blue-green';
  envFileName: string;
  instanceName: string;
  location: string;
  requiredKeys: string[];
  version: string | null;
  updatedAt: string | null;
  checksum: string | null;
  keyCount: number;
  keys: string[];
  connectionStatus: 'healthy' | 'unavailable';
  connectionError: string | null;
}

export interface RevealedEnvironment {
  targetId: string;
  version: string;
  checksum: string;
  envFile: string;
  expiresAt: string;
}

export interface EnvironmentMutation {
  backupId: string;
  targetId: string;
  previousVersion: string;
  version: string;
  changedKeys: string[];
  deployment: {
    requestId: string;
    state: 'queued';
  };
}

export type BackupStatus =
  | 'backed_up'
  | 'secret_created'
  | 'deployment_queued'
  | 'deployment_running'
  | 'deployed'
  | 'failed';

export interface SecretBackup {
  id: string;
  targetId: string;
  operation: 'update' | 'patch' | 'restore';
  sourceVersion: string;
  newVersion: string | null;
  checksum: string;
  changedKeys: string[];
  actorId: string | null;
  actorEmail: string | null;
  status: BackupStatus;
  deploymentRequestId: string | null;
  deploymentRunId: string | null;
  deploymentUrl: string | null;
  errorMessage: string | null;
  restoredFromBackupId: string | null;
  createdAt: string;
  updatedAt: string;
}
