import { api } from '@/shared/api/client';
import { BaseApiService } from '@/shared/api/base.service';
import { Container, ComposeProvisioningTemplate } from '../model/types';
import {
  CreateContainerRequest,
} from './types';
import type {
  DockerCleanupCandidates,
  DockerCleanupResult,
} from '../model/cleanup.types';
import type {
  TopologyNodePositionUpdate,
  TopologySnapshot,
} from '../model/topology.types';

/**
 * Docker 관련 API 호출을 한곳에 모아둔 서비스
 */
export class DockerService extends BaseApiService {
  private readonly basePath = '/docker';

  /**
   * 전체 컨테이너를 조회한다
   * @returns 컨테이너 목록
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
   * 새 컨테이너를 생성한다
   * @param config 컨테이너 설정
   * @returns 생성된 컨테이너
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
   * 컨테이너를 시작한다
   * @param id 컨테이너 ID
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
   * 컨테이너를 중지한다
   * @param id 컨테이너 ID
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
   * 컨테이너를 삭제한다
   * @param id 컨테이너 ID
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
   * 외부 컨테이너를 관리 대상으로 가져온다
   * @param dockerId Docker 컨테이너 ID
   * @returns 가져온 컨테이너
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
   * 새 compose 서비스(인스턴스)를 생성한다
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
   * compose 서비스를 제거한다
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

// 싱글턴 인스턴스로 내보낸다
export const dockerService = new DockerService();
