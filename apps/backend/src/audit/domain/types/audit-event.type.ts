export type AuditDomain =
  'repository' | 'docker' | 'nginx' | 'rbac' | 'security';

export interface AuditDiffSummary {
  changeCount: number;
  keys: string[];
  preview: string;
}

export interface AuditEvent {
  id: string;
  domain: AuditDomain;
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

export interface CreateAuditEventInput {
  domain: AuditDomain;
  action: string;
  summary: string;
  actorId?: string | null;
  actorEmail?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ListAuditEventsInput {
  domain?: AuditDomain | 'all';
  actor?: string;
  actorId?: string;
  target?: string;
  targetId?: string;
  search?: string;
  from?: string;
  to?: string;
  limit?: number;
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
  byDomain: Record<AuditDomain, number>;
  topActors: AuditActorSummary[];
  topTargets: AuditTargetSummary[];
}

export interface AuditExportResult {
  exportedAt: string;
  filters: Omit<ListAuditEventsInput, 'limit'>;
  total: number;
  summary: AuditSummary;
  items: AuditEvent[];
}
