import { api } from '../../lib/api';
import { BaseApiService } from './base.service';
import type {
  IpBan,
  CreateIpBanInput,
} from '../../features/security/lib/security.types';

export class SecurityService extends BaseApiService {
  private readonly basePath = '/security';

  async listBans(): Promise<IpBan[]> {
    try {
      const { data } = await api.get<{ items: IpBan[] }>(
        `${this.basePath}/bans`,
      );
      return data.items;
    } catch (error) {
      this.logError('SecurityService', 'listBans', error);
      this.handleError(error, 'IP 차단 목록 조회 실패');
    }
  }

  async createBan(input: CreateIpBanInput): Promise<IpBan> {
    try {
      const { data } = await api.post<IpBan>(`${this.basePath}/bans`, input);
      return data;
    } catch (error) {
      this.logError('SecurityService', 'createBan', error);
      this.handleError(error, 'IP 차단 추가 실패');
    }
  }

  async removeBan(id: string): Promise<IpBan> {
    try {
      const { data } = await api.delete<IpBan>(
        `${this.basePath}/bans/${id}`,
      );
      return data;
    } catch (error) {
      this.logError('SecurityService', 'removeBan', error);
      this.handleError(error, 'IP 차단 해제 실패');
    }
  }

  async resync(): Promise<{ reloaded: boolean; count: number }> {
    try {
      const { data } = await api.post<{ reloaded: boolean; count: number }>(
        `${this.basePath}/resync`,
      );
      return data;
    } catch (error) {
      this.logError('SecurityService', 'resync', error);
      this.handleError(error, 'nginx 재동기화 실패');
    }
  }
}

export const securityService = new SecurityService();
