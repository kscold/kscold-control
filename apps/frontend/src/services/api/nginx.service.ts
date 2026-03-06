import { api } from '../../lib/api';
import { BaseApiService } from './base.service';
import type {
  NginxSite,
  CreateNginxSiteDto,
  CertInfo,
  DnsCheckResult,
  UpstreamOption,
} from '../../features/nginx/lib/nginx.types';

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

  async createSite(dto: CreateNginxSiteDto): Promise<any> {
    try {
      const { data } = await api.post(`${this.basePath}/sites`, dto);
      return data;
    } catch (error) {
      this.logError('NginxApiService', 'createSite', error);
      throw error;
    }
  }

  async updateSite(name: string, dto: CreateNginxSiteDto): Promise<any> {
    try {
      const { data } = await api.put(`${this.basePath}/sites/${name}`, dto);
      return data;
    } catch (error) {
      this.logError('NginxApiService', 'updateSite', error);
      throw error;
    }
  }

  async deleteSite(name: string): Promise<any> {
    try {
      const { data } = await api.delete(`${this.basePath}/sites/${name}`);
      return data;
    } catch (error) {
      this.logError('NginxApiService', 'deleteSite', error);
      this.handleError(error, '사이트 삭제에 실패했습니다.');
    }
  }

  async toggleSite(name: string): Promise<any> {
    try {
      const { data } = await api.post(`${this.basePath}/sites/${name}/toggle`);
      return data;
    } catch (error) {
      this.logError('NginxApiService', 'toggleSite', error);
      this.handleError(error, '사이트 토글에 실패했습니다.');
    }
  }

  async testConfig(): Promise<{ success: boolean; output: string }> {
    try {
      const { data } = await api.post<{ success: boolean; output: string }>(
        `${this.basePath}/test`,
      );
      return data;
    } catch (error) {
      this.logError('NginxApiService', 'testConfig', error);
      this.handleError(error, 'Nginx 설정 테스트에 실패했습니다.');
    }
  }

  async reloadNginx(): Promise<{ success: boolean; output: string }> {
    try {
      const { data } = await api.post<{ success: boolean; output: string }>(
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
  }): Promise<any> {
    try {
      const { data } = await api.post(`${this.basePath}/certs/issue`, form);
      return data;
    } catch (error) {
      this.logError('NginxApiService', 'issueCert', error);
      throw error;
    }
  }

  async renewAll(): Promise<any> {
    try {
      const { data } = await api.post(`${this.basePath}/certs/renew`);
      return data;
    } catch (error) {
      this.logError('NginxApiService', 'renewAll', error);
      throw error;
    }
  }

  async getPublicIp(): Promise<string> {
    try {
      const { data } = await api.get<{ ip: string }>(
        `${this.basePath}/dns/ip`,
      );
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
