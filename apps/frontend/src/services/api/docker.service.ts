import { api } from '@/shared/api/client';
import { BaseApiService } from '@/shared/api/base.service';
import { Container, ComposeProvisioningTemplate } from '../../types';
import {
  CreateContainerRequest,
  ContainerStatsResponse,
} from '@/shared/api/types';
import type {
  DockerCleanupCandidates,
  DockerCleanupResult,
} from '../../features/docker/lib/docker-cleanup.types';
import type {
  TopologyNodePositionUpdate,
  TopologySnapshot,
} from '../../features/topology/lib/topology.types';

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

  /**
   * Import an external container into management
   * @param dockerId Docker container ID
   * @returns Imported container
   */
  async importContainer(dockerId: string): Promise<Container> {
    try {
      const { data } = await api.post<Container>(
        `${this.basePath}/containers/import`,
        { dockerId },
      );
      return data;
    } catch (error) {
      this.logError('DockerService', 'importContainer', error);
      this.handleError(error, 'Failed to import container');
    }
  }

  /**
   * Create a new compose service (instance)
   */
  async createComposeService(config: {
    name: string;
    image: string;
    ports: Record<string, number>;
    cpus: string;
    memLimit: string;
    command?: string;
  }): Promise<any> {
    try {
      const { data } = await api.post(
        `${this.basePath}/compose/services`,
        config,
      );
      return data;
    } catch (error) {
      this.logError('DockerService', 'createComposeService', error);
      this.handleError(error, 'Failed to create compose service');
    }
  }

  /**
   * compose 인스턴스 생성 기본값을 조회합니다.
   */
  async getComposeProvisioningTemplate(): Promise<ComposeProvisioningTemplate> {
    try {
      const { data } = await api.get<ComposeProvisioningTemplate>(
        `${this.basePath}/compose/provisioning-template`,
      );
      return data;
    } catch (error) {
      this.logError('DockerService', 'getComposeProvisioningTemplate', error);
      this.handleError(error, 'Failed to load compose provisioning template');
    }
  }

  /**
   * Remove a compose service
   */
  async removeComposeService(name: string): Promise<void> {
    try {
      await api.delete(`${this.basePath}/compose/services/${name}`);
    } catch (error) {
      this.logError('DockerService', 'removeComposeService', error);
      this.handleError(error, `Failed to remove compose service ${name}`);
    }
  }

  async getTopologySnapshot(): Promise<TopologySnapshot> {
    try {
      const { data } = await api.get<TopologySnapshot>(
        `${this.basePath}/topology/snapshot`,
      );
      return data;
    } catch (error) {
      this.logError('DockerService', 'getTopologySnapshot', error);
      this.handleError(error, 'Failed to load topology snapshot');
    }
  }

  async updateTopologyNodePositions(
    positions: TopologyNodePositionUpdate[],
  ): Promise<void> {
    try {
      await api.patch(`${this.basePath}/topology/layout/nodes`, { positions });
    } catch (error) {
      this.logError('DockerService', 'updateTopologyNodePositions', error);
      this.handleError(error, 'Failed to save topology layout');
    }
  }

  async getCleanupCandidates(): Promise<DockerCleanupCandidates> {
    try {
      const { data } = await api.get<DockerCleanupCandidates>(
        `${this.basePath}/cleanup/candidates`,
      );
      return data;
    } catch (error) {
      this.logError('DockerService', 'getCleanupCandidates', error);
      this.handleError(error, 'Failed to load cleanup candidates');
    }
  }

  async pruneDanglingImages(
    dryRun: boolean = true,
  ): Promise<DockerCleanupResult> {
    return this.runCleanupAction('/cleanup/images/prune', dryRun);
  }

  async pruneBuildCache(dryRun: boolean = true): Promise<DockerCleanupResult> {
    return this.runCleanupAction('/cleanup/build-cache/prune', dryRun);
  }

  async pruneExitedContainers(
    dryRun: boolean = true,
  ): Promise<DockerCleanupResult> {
    return this.runCleanupAction('/cleanup/containers/prune-exited', dryRun);
  }

  async pruneDanglingVolumes(
    dryRun: boolean = true,
  ): Promise<DockerCleanupResult> {
    return this.runCleanupAction('/cleanup/volumes/prune-dangling', dryRun);
  }

  private async runCleanupAction(
    path: string,
    dryRun: boolean,
  ): Promise<DockerCleanupResult> {
    try {
      const { data } = await api.post<DockerCleanupResult>(
        `${this.basePath}${path}`,
        { dryRun },
      );
      return data;
    } catch (error) {
      this.logError('DockerService', 'runCleanupAction', error);
      this.handleError(error, 'Failed to execute cleanup action');
    }
  }
}

// Export singleton instance
export const dockerService = new DockerService();
