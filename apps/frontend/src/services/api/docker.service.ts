import { api } from '../../lib/api';
import { BaseApiService } from './base.service';
import {
  Container,
  CreateContainerRequest,
  ContainerStatsResponse,
} from '../../types';

/**
 * Docker API Service
 * Centralizes all Docker-related API calls
 *
 * Replaces direct API calls in:
 * - DockerDashboard.tsx
 * - DashboardPage.tsx
 */
export class DockerService extends BaseApiService {
  private readonly basePath = '/docker';

  /**
   * Get all containers
   * @returns List of containers
   */
  async listContainers(): Promise<Container[]> {
    try {
      const { data } = await api.get<Container[]>(
        `${this.basePath}/containers`,
      );
      return data;
    } catch (error) {
      this.logError('DockerService', 'listContainers', error);
      this.handleError(error, 'Failed to load containers');
    }
  }

  /**
   * Create a new container
   * @param config Container configuration
   * @returns Created container
   */
  async createContainer(config: CreateContainerRequest): Promise<Container> {
    try {
      const { data } = await api.post<Container>(
        `${this.basePath}/containers`,
        config,
      );
      return data;
    } catch (error) {
      this.logError('DockerService', 'createContainer', error);
      this.handleError(error, 'Failed to create container');
    }
  }

  /**
   * Start a container
   * @param id Container ID
   */
  async startContainer(id: string): Promise<void> {
    try {
      await api.post(`${this.basePath}/containers/${id}/start`);
    } catch (error) {
      this.logError('DockerService', 'startContainer', error);
      this.handleError(error, `Failed to start container ${id}`);
    }
  }

  /**
   * Stop a container
   * @param id Container ID
   */
  async stopContainer(id: string): Promise<void> {
    try {
      await api.post(`${this.basePath}/containers/${id}/stop`);
    } catch (error) {
      this.logError('DockerService', 'stopContainer', error);
      this.handleError(error, `Failed to stop container ${id}`);
    }
  }

  /**
   * Delete a container
   * @param id Container ID
   */
  async deleteContainer(id: string): Promise<void> {
    try {
      await api.delete(`${this.basePath}/containers/${id}`);
    } catch (error) {
      this.logError('DockerService', 'deleteContainer', error);
      this.handleError(error, `Failed to delete container ${id}`);
    }
  }

  /**
   * Get container statistics
   * @param id Container ID
   * @returns Container stats
   */
  async getContainerStats(id: string): Promise<ContainerStatsResponse> {
    try {
      const { data } = await api.get<ContainerStatsResponse>(
        `${this.basePath}/containers/${id}/stats`,
      );
      return data;
    } catch (error) {
      this.logError('DockerService', 'getContainerStats', error);
      this.handleError(error, `Failed to get stats for container ${id}`);
    }
  }

  /**
   * Stream container logs
   * @param id Container ID
   * @param lines Number of lines to retrieve
   * @returns Log lines
   */
  async getContainerLogs(id: string, lines: number = 100): Promise<string[]> {
    try {
      const { data } = await api.get<string[]>(
        `${this.basePath}/containers/${id}/logs`,
        { params: { lines } },
      );
      return data;
    } catch (error) {
      this.logError('DockerService', 'getContainerLogs', error);
      this.handleError(error, `Failed to get logs for container ${id}`);
    }
  }
}

// Export singleton instance
export const dockerService = new DockerService();
