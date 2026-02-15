import { api } from '../../lib/api';
import { BaseApiService } from './base.service';
import {
  GetLogsRequest,
  GetLogsResponse,
  GetDockerContainerLogsResponse,
} from '../../types';

/**
 * Logs API Service
 * Centralizes all logging-related API calls
 *
 * Replaces direct API calls in:
 * - LogsViewer.tsx
 */
export class LogsService extends BaseApiService {
  private readonly basePath = '/logs';

  /**
   * Get system logs
   * @param request Log request parameters
   * @returns Log lines
   */
  async getLogs(request: GetLogsRequest): Promise<string[]> {
    try {
      const { logType, lines = 100, containerId } = request;

      const params: any = { lines };
      if (containerId) {
        params.containerId = containerId;
      }

      const { data } = await api.get<string[]>(`${this.basePath}/${logType}`, {
        params,
      });
      return data;
    } catch (error) {
      this.logError('LogsService', 'getLogs', error);
      this.handleError(error, 'Failed to load logs');
    }
  }

  /**
   * Get PM2 logs
   * @param lines Number of lines to retrieve
   * @returns Log lines
   */
  async getPm2Logs(lines: number = 100): Promise<string[]> {
    try {
      const { data } = await api.get<string[]>(`${this.basePath}/pm2`, {
        params: { lines },
      });
      return data;
    } catch (error) {
      this.logError('LogsService', 'getPm2Logs', error);
      this.handleError(error, 'Failed to load PM2 logs');
    }
  }

  /**
   * Get list of Docker containers for logs
   * @returns List of containers
   */
  async getDockerContainerList(): Promise<GetDockerContainerLogsResponse> {
    try {
      const { data } = await api.get<GetDockerContainerLogsResponse>(
        `${this.basePath}/docker/containers`,
      );
      return data;
    } catch (error) {
      this.logError('LogsService', 'getDockerContainerList', error);
      this.handleError(error, 'Failed to load Docker container list');
    }
  }
}

// Export singleton instance
export const logsService = new LogsService();
