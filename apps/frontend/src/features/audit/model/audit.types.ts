export type AuditDomain =
  | 'all'
  | 'repository'
  | 'docker'
  | 'nginx'
  | 'rbac'
  | 'security'
  | 'secrets'
  | 'backup'
  | 'maintenance';

export type AuditEventDomain = Exclude<AuditDomain, 'all'>;

export interface AuditDiffSummary {
  changeCount: number;
  keys: string[];
  preview: string;
}

export interface AuditEvent {
  id: string;
  domain: AuditEventDomain;
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
    security: number;
    secrets: number;
    backup: number;
    maintenance: number;
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

/** 감사 화면 보기: 확인할 일 · 사람이 한 일 · 자동으로 된 일 · 전체 */
export type AuditFeedView = 'attention' | 'human' | 'system' | 'all';

export type AuditFeedPeriod = 'today' | 'week' | 'month' | 'all';

export interface AuditFeedItem {
  event: AuditEvent;
  kind: 'human' | 'system';
  attention: boolean;
  /** 짧은 간격으로 반복돼 한 줄로 묶인 기록 수 */
  count: number;
  /** 묶음에서 가장 오래된 기록 시각 */
  firstAt: string;
}

export interface AuditFeed {
  items: AuditFeedItem[];
  counts: Record<AuditFeedView, number>;
  hasMore: boolean;
}
