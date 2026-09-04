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
}
