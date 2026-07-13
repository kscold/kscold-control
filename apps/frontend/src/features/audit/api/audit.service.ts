import { BaseApiService } from '@/shared/api/base.service';
import type {
  AuditExportPayload,
  AuditDomain,
  AuditEvent,
  AuditSummary,
} from '../lib/audit.types';
import { api } from '@/shared/api/client';

type AuditQueryParams = {
  domain?: AuditDomain;
  limit?: number;
  actor?: string;
  search?: string;
  target?: string;
  from?: string;
  to?: string;
};

function normalizeDate(value?: string) {
  if (!value) {
    return '';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return parsed.toISOString();
}

class AuditService extends BaseApiService {
  private readonly basePath = '/audit';

  private buildQuery(params?: AuditQueryParams) {
    const query = new URLSearchParams();
    if (params?.domain && params.domain !== 'all') {
      query.set('domain', params.domain);
    }
    if (params?.actor?.trim()) {
      query.set('actor', params.actor.trim());
    }
    if (params?.limit) {
      query.set('limit', String(params.limit));
    }
    if (params?.search?.trim()) {
      query.set('search', params.search.trim());
    }
    if (params?.target?.trim()) {
      query.set('target', params.target.trim());
    }
    const from = normalizeDate(params?.from);
    if (from) {
      query.set('from', from);
    }
    const to = normalizeDate(params?.to);
    if (to) {
      query.set('to', to);
    }

    return query;
  }

  async listEvents(params?: AuditQueryParams): Promise<AuditEvent[]> {
    const query = this.buildQuery(params);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    const response = await api.get<{ items: AuditEvent[] }>(
      `${this.basePath}/events${suffix}`,
    );
    return response.data.items ?? [];
  }

  async getSummary(params?: AuditQueryParams): Promise<AuditSummary> {
    const query = this.buildQuery(params);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    const response = await api.get<{ item: AuditSummary }>(
      `${this.basePath}/summary${suffix}`,
    );
    return response.data.item;
  }

  async exportEvents(params?: AuditQueryParams): Promise<AuditExportPayload> {
    const query = this.buildQuery(params);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    const response = await api.get<{ item: AuditExportPayload }>(
      `${this.basePath}/export${suffix}`,
    );
    return response.data.item;
  }
}

export const auditService = new AuditService();
