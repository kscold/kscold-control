export interface DockerCleanupCandidateItem {
  id: string;
  label: string;
  detail?: string;
  size: number;
  reclaimable?: number;
  state?: string;
  readOnly?: boolean;
}

export interface DockerCleanupCategory {
  items: DockerCleanupCandidateItem[];
  totalBytes: number;
  reclaimableBytes: number;
}

export interface DockerCleanupCandidates {
  images: DockerCleanupCategory;
  containers: DockerCleanupCategory;
  volumes: DockerCleanupCategory;
  buildCache: DockerCleanupCategory;
  composeOrphans: DockerCleanupCategory;
  artifactFiles: DockerCleanupCategory;
  summary: {
    reclaimableBytes: number;
    readOnlyBytes: number;
    totalCandidates: number;
  };
}

export interface DockerCleanupResult {
  success: boolean;
  dryRun: boolean;
  reclaimedBytes: number;
  removedCount: number;
  items: DockerCleanupCandidateItem[];
}
