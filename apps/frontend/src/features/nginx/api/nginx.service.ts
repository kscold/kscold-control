import { api } from '@/shared/api/client';
import { BaseApiService } from '@/shared/api/base.service';
import type {
  NginxSite,
  CreateNginxSiteDto,
  CertInfo,
  CertRenewalStatus,
  DnsCheckResult,
  UpstreamOption,
  NginxCommandResult,
  NginxSiteMutationResult,
  NginxSiteDeleteResult,
  NginxSiteToggleResult,
} from '../model/nginx.types';

export class NginxApiService extends BaseApiService {
  private readonly basePath = '/nginx';

  async listSites(): Promise<NginxSite[]> {
    try {
      const { data } = await api.get<NginxSite[]>(`${this.basePath}/sites`);
      return data;
    } catch (error) {
      this.logError('NginxApiService', 'listSites', error);
      this.handleError(error, '사이트 목록을 불러오는데 실패했습니다.');
    }
  }

  async createSite(dto: CreateNginxSiteDto): Promise<NginxSiteMutationResult> {
    try {
      const { data } = await api.post<NginxSiteMutationResult>(
        `${this.basePath}/sites`,
        dto,
      );
      return data;
    } catch (error) {
      this.logError('NginxApiService', 'createSite', error);
      throw error;
    }
  }

  async updateSite(
    name: string,
    dto: CreateNginxSiteDto,
  ): Promise<NginxSiteMutationResult> {
    try {
      const { data } = await api.put<NginxSiteMutationResult>(
        `${this.basePath}/sites/${name}`,
        dto,
      );
      return data;
    } catch (error) {
      this.logError('NginxApiService', 'updateSite', error);
      throw error;
    }
  }

  async deleteSite(name: string): Promise<NginxSiteDeleteResult> {
    try {
      const { data } = await api.delete<NginxSiteDeleteResult>(
        `${this.basePath}/sites/${name}`,
      );
      return data;
    } catch (error) {
      this.logError('NginxApiService', 'deleteSite', error);
      this.handleError(error, '사이트 삭제에 실패했습니다.');
    }
  }

  async toggleSite(name: string): Promise<NginxSiteToggleResult> {
    try {
      const { data } = await api.post<NginxSiteToggleResult>(
        `${this.basePath}/sites/${name}/toggle`,
      );
      return data;
    } catch (error) {
      this.logError('NginxApiService', 'toggleSite', error);
      this.handleError(error, '사이트 토글에 실패했습니다.');
    }
  }

  async testConfig(): Promise<NginxCommandResult> {
    try {
      const { data } = await api.post<NginxCommandResult>(
        `${this.basePath}/test`,
      );
      return data;
    } catch (error) {
      this.logError('NginxApiService', 'testConfig', error);
      this.handleError(error, 'Nginx 설정 테스트에 실패했습니다.');
    }
  }

  async reloadNginx(): Promise<NginxCommandResult> {
    try {
      const { data } = await api.post<NginxCommandResult>(
        `${this.basePath}/reload`,
      );
      return data;
    } catch (error) {
      this.logError('NginxApiService', 'reloadNginx', error);
      this.handleError(error, 'Nginx 리로드에 실패했습니다.');
    }
  }

  async getUpstreams(): Promise<UpstreamOption[]> {
    try {
      const { data } = await api.get<UpstreamOption[]>(
        `${this.basePath}/upstreams`,
      );
      return data;
    } catch (error) {
      this.logError('NginxApiService', 'getUpstreams', error);
      this.handleError(error, 'Upstream 목록을 불러오는데 실패했습니다.');
    }
  }

  async listCerts(): Promise<CertInfo[]> {
    try {
      const { data } = await api.get<CertInfo[]>(`${this.basePath}/certs`);
      return data;
    } catch (error) {
      this.logError('NginxApiService', 'listCerts', error);
      this.handleError(error, '인증서 목록을 불러오는데 실패했습니다.');
    }
  }

  async issueCert(form: {
    domain: string;
    email: string;
    mode: string;
  }): Promise<NginxCommandResult> {
    try {
      const { data } = await api.post<NginxCommandResult>(
        `${this.basePath}/certs/issue`,
        form,
      );
      return data;
    } catch (error) {
      this.logError('NginxApiService', 'issueCert', error);
      throw error;
    }
  }

  async renewAll(): Promise<NginxCommandResult> {
    try {
      const { data } = await api.post<NginxCommandResult>(
        `${this.basePath}/certs/renew`,
      );
      return data;
    } catch (error) {
      this.logError('NginxApiService', 'renewAll', error);
      throw error;
    }
  }

  async getRenewalStatus(): Promise<CertRenewalStatus> {
    try {
      const { data } = await api.get<CertRenewalStatus>(
        `${this.basePath}/certs/renewal-status`,
      );
      return data;
    } catch (error) {
      this.logError('NginxApiService', 'getRenewalStatus', error);
      this.handleError(error, '자동 갱신 상태를 불러오는데 실패했습니다.');
    }
  }

  async getPublicIp(): Promise<string> {
    try {
      const { data } = await api.get<{ ip: string }>(`${this.basePath}/dns/ip`);
      return data.ip;
    } catch (error) {
      this.logError('NginxApiService', 'getPublicIp', error);
      this.handleError(error, '공인 IP를 불러오는데 실패했습니다.');
    }
  }

  async verifyDns(domain: string): Promise<DnsCheckResult> {
    try {
      const { data } = await api.post<DnsCheckResult>(
        `${this.basePath}/dns/verify`,
        { domain },
      );
      return data;
    } catch (error) {
      this.logError('NginxApiService', 'verifyDns', error);
      throw error;
    }
  }

  async verifyAllDns(): Promise<DnsCheckResult[]> {
    try {
      const { data } = await api.get<DnsCheckResult[]>(
        `${this.basePath}/dns/verify-all`,
      );
      return data;
    } catch (error) {
      this.logError('NginxApiService', 'verifyAllDns', error);
      this.handleError(error, 'DNS 검증에 실패했습니다.');
    }
  }
}

export const nginxService = new NginxApiService();
