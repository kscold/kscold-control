import { BaseApiService } from './base.service';
import type { AuditDomain, AuditEvent } from '../../features/audit/lib/audit.types';
import { api } from '../../lib/api';

class AuditService extends BaseApiService {
  private readonly basePath = '/audit';

  async listEvents(params?: {
    domain?: AuditDomain;
    limit?: number;
  }): Promise<AuditEvent[]> {
    const query = new URLSearchParams();
    if (params?.domain && params.domain !== 'all') {
      query.set('domain', params.domain);
    }
    if (params?.limit) {
      query.set('limit', String(params.limit));
    }

    const suffix = query.toString() ? `?${query.toString()}` : '';
    const response = await api.get<{ items: AuditEvent[] }>(
      `${this.basePath}/events${suffix}`,
    );
    return response.data.items ?? [];
  }
}

export const auditService = new AuditService();
