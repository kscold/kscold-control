import { api } from '../../lib/api';
import { BaseApiService } from './base.service';
import { SystemInfoResponse } from '../../types';

/**
 * System API Service
 * Centralizes all system-related API calls
 *
 * Replaces direct API calls in:
 * - DashboardPage.tsx
 */
export class SystemService extends BaseApiService {
  private readonly basePath = '/system';

  /**
   * Get system information
   * @returns System info (CPU, memory, uptime, etc.)
   */
  async getSystemInfo(): Promise<SystemInfoResponse> {
    try {
      const { data } = await api.get<SystemInfoResponse>(
        `${this.basePath}/info`,
      );
      return data;
    } catch (error) {
      this.logError('SystemService', 'getSystemInfo', error);
      this.handleError(error, 'Failed to load system information');
    }
  }
}

// Export singleton instance
export const systemService = new SystemService();
