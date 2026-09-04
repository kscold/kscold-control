export interface KeyManagementTarget {
  id: string;
  displayName: string;
  provider: 'gcp-secret-manager';
  projectId: string;
  secretName: string;
  instanceName: string;
  zone: string;
  repository: string;
  workflow: string;
  ref: string;
  version: string;
  updatedAt: string | null;
  checksum: string;
  keyCount: number;
  keys: string[];
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
