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
