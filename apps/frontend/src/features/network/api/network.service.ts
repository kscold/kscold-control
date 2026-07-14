import { api } from '@/shared/api/client';
import { BaseApiService } from '@/shared/api/base.service';
import type { PortMapping } from '../model/network.types';

export class NetworkApiService extends BaseApiService {
  private readonly basePath = '/upnp';

  async getMappings(): Promise<PortMapping[]> {
    try {
      const { data } = await api.get<PortMapping[]>(
        `${this.basePath}/mappings`,
      );
      return data;
    } catch (error) {
      this.logError('NetworkApiService', 'getMappings', error);
      this.handleError(error, 'UPnP 조회 실패');
    }
  }

  async addMapping(dto: {
    publicPort: number;
    privatePort: number;
    protocol: string;
    description: string;
  }): Promise<void> {
    try {
      await api.post(`${this.basePath}/mappings`, dto);
    } catch (error) {
      this.logError('NetworkApiService', 'addMapping', error);
      this.handleError(error, '포트 매핑 추가 실패');
    }
  }

  async removeMapping(publicPort: number, protocol: string): Promise<void> {
    try {
      await api.delete(
        `${this.basePath}/mappings/${publicPort}?protocol=${protocol}`,
      );
    } catch (error) {
      this.logError('NetworkApiService', 'removeMapping', error);
      this.handleError(error, '포트 매핑 삭제 실패');
    }
  }

  async getExternalIp(): Promise<string> {
    try {
      const { data } = await api.get<{ ip: string }>(
        `${this.basePath}/external-ip`,
      );
      return data.ip;
    } catch (error) {
      this.logError('NetworkApiService', 'getExternalIp', error);
      this.handleError(error, 'External IP 조회 실패');
    }
  }
}

export const networkService = new NetworkApiService();
