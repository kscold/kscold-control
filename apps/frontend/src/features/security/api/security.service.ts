import { api } from '@/shared/api/client';
import { BaseApiService } from '@/shared/api/base.service';
import type {
  AttackMapView,
  IpBan,
  CreateIpBanInput,
  SshAccessOverview,
  SshBlock,
  SshBlockScope,
  SshFirewallBlocks,
  SshSession,
} from '../model/security.types';

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
      const { data } = await api.delete<IpBan>(`${this.basePath}/bans/${id}`);
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

  async getSshAccess(
    days: number,
    signal?: AbortSignal,
  ): Promise<SshAccessOverview> {
    try {
      const { data } = await api.get<SshAccessOverview>(
        `${this.basePath}/ssh`,
        {
          params: { days },
          signal,
          timeout: 15_000,
        },
      );
      return data;
    } catch (error) {
      if (signal?.aborted) throw error;
      this.logError('SecurityService', 'getSshAccess', error);
      this.handleError(error, 'SSH 접속 기록 조회 실패');
    }
  }

  async getAttackMap(
    days: number,
    signal?: AbortSignal,
  ): Promise<AttackMapView> {
    try {
      const { data } = await api.get<AttackMapView>(
        `${this.basePath}/attack-map`,
        { params: { days }, signal, timeout: 15_000 },
      );
      return data;
    } catch (error) {
      if (signal?.aborted) throw error;
      this.logError('SecurityService', 'getAttackMap', error);
      this.handleError(error, '공격 지도 조회 실패');
    }
  }

  async getFirewallBlocks(): Promise<SshFirewallBlocks> {
    try {
      const { data } = await api.get<SshFirewallBlocks>(
        `${this.basePath}/ssh/blocks`,
      );
      return data;
    } catch (error) {
      this.logError('SecurityService', 'getFirewallBlocks', error);
      this.handleError(error, '방화벽 차단 목록 조회 실패');
    }
  }

  async terminateSshSession(pid: number): Promise<SshSession> {
    try {
      const { data } = await api.post<SshSession>(
        `${this.basePath}/ssh/sessions/${pid}/terminate`,
      );
      return data;
    } catch (error) {
      this.logError('SecurityService', 'terminateSshSession', error);
      this.handleError(error, 'SSH 세션 끊기 실패');
    }
  }

  async blockSshIp(
    ip: string,
    reason?: string,
    scope: SshBlockScope = 'all',
  ): Promise<SshBlock> {
    try {
      const { data } = await api.post<SshBlock>(`${this.basePath}/ssh/blocks`, {
        ip,
        reason: reason || undefined,
        scope,
      });
      return data;
    } catch (error) {
      this.logError('SecurityService', 'blockSshIp', error);
      this.handleError(error, 'SSH 차단 실패');
    }
  }

  async setSshBlockScope(ip: string, scope: SshBlockScope): Promise<void> {
    try {
      await api.patch(`${this.basePath}/ssh/blocks/${encodeURIComponent(ip)}`, {
        scope,
      });
    } catch (error) {
      this.logError('SecurityService', 'setSshBlockScope', error);
      this.handleError(error, '차단 범위 변경 실패');
    }
  }

  async unblockSshIp(ip: string): Promise<void> {
    try {
      await api.delete(`${this.basePath}/ssh/blocks/${encodeURIComponent(ip)}`);
    } catch (error) {
      this.logError('SecurityService', 'unblockSshIp', error);
      this.handleError(error, 'SSH 차단 해제 실패');
    }
  }

  async addSshKnownIp(ip: string, label?: string): Promise<void> {
    try {
      await api.post(`${this.basePath}/ssh/known-ips`, {
        ip,
        label: label || undefined,
      });
    } catch (error) {
      this.logError('SecurityService', 'addSshKnownIp', error);
      this.handleError(error, '내 IP 등록 실패');
    }
  }

  async setSshKnownIpLabel(ip: string, label: string): Promise<void> {
    try {
      await api.patch(
        `${this.basePath}/ssh/known-ips/${encodeURIComponent(ip)}`,
        { label: label || undefined },
      );
    } catch (error) {
      this.logError('SecurityService', 'setSshKnownIpLabel', error);
      this.handleError(error, '내 IP 별칭 변경 실패');
    }
  }

  async removeSshKnownIp(ip: string): Promise<void> {
    try {
      await api.delete(
        `${this.basePath}/ssh/known-ips/${encodeURIComponent(ip)}`,
      );
    } catch (error) {
      this.logError('SecurityService', 'removeSshKnownIp', error);
      this.handleError(error, '내 IP 삭제 실패');
    }
  }
}

export const securityService = new SecurityService();
