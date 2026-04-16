export type AuditDomain = 'all' | 'repository' | 'docker' | 'nginx' | 'rbac';

export interface AuditEvent {
  id: string;
  domain: Exclude<AuditDomain, 'all'>;
  action: string;
  summary: string;
  actorId: string | null;
  actorEmail: string | null;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AuditSummary {
  total: number;
  last24Hours: number;
  byDomain: {
    repository: number;
    docker: number;
    nginx: number;
    rbac: number;
  };
}
