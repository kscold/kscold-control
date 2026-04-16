import { BaseApiService } from './base.service';
import type {
  AuditDomain,
  AuditEvent,
  AuditSummary,
} from '../../features/audit/lib/audit.types';
import { api } from '../../lib/api';

class AuditService extends BaseApiService {
  private readonly basePath = '/audit';

  async listEvents(params?: {
    domain?: AuditDomain;
    limit?: number;
    actor?: string;
    search?: string;
    target?: string;
    from?: string;
    to?: string;
  }): Promise<AuditEvent[]> {
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
    if (params?.from) {
      query.set('from', params.from);
    }
    if (params?.to) {
      query.set('to', params.to);
    }

    const suffix = query.toString() ? `?${query.toString()}` : '';
    const response = await api.get<{ items: AuditEvent[] }>(
      `${this.basePath}/events${suffix}`,
    );
    return response.data.items ?? [];
  }

  async getSummary(params?: {
    domain?: AuditDomain;
    actor?: string;
    search?: string;
    target?: string;
    from?: string;
    to?: string;
  }): Promise<AuditSummary> {
    const query = new URLSearchParams();
    if (params?.domain && params.domain !== 'all') {
      query.set('domain', params.domain);
    }
    if (params?.actor?.trim()) {
      query.set('actor', params.actor.trim());
    }
    if (params?.search?.trim()) {
      query.set('search', params.search.trim());
    }
    if (params?.target?.trim()) {
      query.set('target', params.target.trim());
    }
    if (params?.from) {
      query.set('from', params.from);
    }
    if (params?.to) {
      query.set('to', params.to);
    }

    const suffix = query.toString() ? `?${query.toString()}` : '';
    const response = await api.get<{ item: AuditSummary }>(
      `${this.basePath}/summary${suffix}`,
    );
    return response.data.item;
  }
}

export const auditService = new AuditService();
