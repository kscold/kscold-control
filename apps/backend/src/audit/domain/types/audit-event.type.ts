export type AuditDomain = 'repository' | 'docker' | 'nginx' | 'rbac';

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

export interface AuditSummary {
  total: number;
  last24Hours: number;
  byDomain: Record<AuditDomain, number>;
}
