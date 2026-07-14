export type AuditDomain = 'all' | 'repository' | 'docker' | 'nginx' | 'rbac';

export interface AuditDiffSummary {
  changeCount: number;
  keys: string[];
  preview: string;
}

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
  diffSummary?: AuditDiffSummary | null;
  createdAt: string;
}

export interface AuditActorSummary {
  key: string;
  actorId: string | null;
  actorEmail: string | null;
  count: number;
}

export interface AuditTargetSummary {
  key: string;
  targetType: string | null;
  targetId: string | null;
  count: number;
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
  topActors: AuditActorSummary[];
  topTargets: AuditTargetSummary[];
}

export interface AuditExportPayload {
  exportedAt: string;
  filters: {
    actor?: string;
    actorId?: string;
    domain?: AuditDomain;
    from?: string;
    search?: string;
    target?: string;
    targetId?: string;
    to?: string;
  };
  total: number;
  summary: AuditSummary;
  items: AuditEvent[];
}

export interface AuditFilterPreset {
  id: string;
  label: string;
  pinned: boolean;
  actor: string;
  domain: AuditDomain;
  from: string;
  search: string;
  target: string;
  to: string;
}
