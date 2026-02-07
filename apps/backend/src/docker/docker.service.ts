import { Injectable, OnModuleInit } from '@nestjs/common';
import Docker from 'dockerode';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Container } from '../entities/container.entity';

export interface CreateContainerDto {
  name: string;
  image: string;
  ports: Record<string, number>;
  resources: {
    cpus: number;
    memory: string;
  };
  environment?: Record<string, string>;
  userId: string;
}

@Injectable()
export class DockerService implements OnModuleInit {
  private docker: Docker;

  constructor(
    @InjectRepository(Container)
    private containerRepo: Repository<Container>,
  ) {}

  onModuleInit() {
    // Docker 소켓 연결
    this.docker = new Docker({ socketPath: '/var/run/docker.sock' });
  }

  /**
   * 컨테이너 목록 조회
   */
  async listContainers(userId?: string) {
    const dbContainers = userId
      ? await this.containerRepo.find({ where: { userId } })
      : await this.containerRepo.find();

    // Docker 실제 상태와 동기화
    const dockerContainers = await this.docker.listContainers({ all: true });

    return dbContainers.map((container) => {
      const dockerInfo = dockerContainers.find((dc) =>
        dc.Id.startsWith(container.dockerId),
      );

      return {
        ...container,
        liveStatus: dockerInfo?.State || 'unknown',
        dockerInfo: dockerInfo
          ? {
              state: dockerInfo.State,
              status: dockerInfo.Status,
              ports: dockerInfo.Ports,
            }
          : null,
      };
    });
  }

  /**
   * 컨테이너 생성 (우분투 템플릿)
   */
  async createContainer(dto: CreateContainerDto) {
    // Docker 컨테이너 생성
    const container = await this.docker.createContainer({
      Image: dto.image,
      name: dto.name,
      Hostname: dto.name,
      ExposedPorts: Object.keys(dto.ports).reduce(
        (acc, port) => {
          acc[`${port}/tcp`] = {};
          return acc;
        },
        {} as Record<string, any>,
      ),
      HostConfig: {
        PortBindings: Object.entries(dto.ports).reduce(
          (acc, [internal, external]) => {
            acc[`${internal}/tcp`] = [{ HostPort: external.toString() }];
            return acc;
          },
          {} as Record<string, any>,
        ),
        NanoCpus: dto.resources.cpus * 1e9, // CPU 제한
        Memory: this.parseMemory(dto.resources.memory), // 메모리 제한
      },
      Env: dto.environment
        ? Object.entries(dto.environment).map(([k, v]) => `${k}=${v}`)
        : [],
    });

    // DB에 저장
    const dbContainer = this.containerRepo.create({
      dockerId: container.id,
      name: dto.name,
      image: dto.image,
      ports: dto.ports,
      resources: dto.resources,
      environment: dto.environment,
      userId: dto.userId,
      status: 'created',
    });

    await this.containerRepo.save(dbContainer);

    return { container: dbContainer, dockerId: container.id };
  }

  /**
   * 컨테이너 시작
   */
  async startContainer(id: string) {
    const container = await this.containerRepo.findOne({ where: { id } });
    if (!container) throw new Error('Container not found');

    const dockerContainer = this.docker.getContainer(container.dockerId);
    await dockerContainer.start();

    container.status = 'running';
    await this.containerRepo.save(container);

    return container;
  }

  /**
   * 컨테이너 중지
   */
  async stopContainer(id: string) {
    const container = await this.containerRepo.findOne({ where: { id } });
    if (!container) throw new Error('Container not found');

    const dockerContainer = this.docker.getContainer(container.dockerId);
    await dockerContainer.stop();

    container.status = 'stopped';
    container.stoppedAt = new Date();
    await this.containerRepo.save(container);

    return container;
  }

  /**
   * 컨테이너 삭제
   */
  async removeContainer(id: string) {
    const container = await this.containerRepo.findOne({ where: { id } });
    if (!container) throw new Error('Container not found');

    const dockerContainer = this.docker.getContainer(container.dockerId);

    try {
      await dockerContainer.stop();
    } catch (e) {
      // 이미 중지된 경우 무시
    }

    await dockerContainer.remove();
    await this.containerRepo.delete(id);

    return { success: true };
  }

  /**
   * 컨테이너 로그 스트리밍 (Observable)
   */
  async streamLogs(id: string, callback: (chunk: string) => void) {
    const container = await this.containerRepo.findOne({ where: { id } });
    if (!container) throw new Error('Container not found');

    const dockerContainer = this.docker.getContainer(container.dockerId);
    const stream = await dockerContainer.logs({
      follow: true,
      stdout: true,
      stderr: true,
      tail: 100,
    });

    stream.on('data', (chunk) => {
      callback(chunk.toString('utf8'));
    });

    return stream;
  }

  /**
   * 컨테이너 통계 (CPU, 메모리)
   */
  async getStats(id: string) {
    const container = await this.containerRepo.findOne({ where: { id } });
    if (!container) throw new Error('Container not found');

    const dockerContainer = this.docker.getContainer(container.dockerId);
    const stats = await dockerContainer.stats({ stream: false });

    return {
      cpu: this.calculateCpuPercent(stats),
      memory: {
        used: stats.memory_stats.usage,
        limit: stats.memory_stats.limit,
        percent: (stats.memory_stats.usage / stats.memory_stats.limit) * 100,
      },
    };
  }

  // 유틸리티
  private parseMemory(memory: string): number {
    const units: Record<string, number> = {
      b: 1,
      k: 1024,
      m: 1024 ** 2,
      g: 1024 ** 3,
    };
    const match = memory.match(/^(\d+)([bkmg])$/i);
    if (!match) throw new Error('Invalid memory format');
    return parseInt(match[1]) * units[match[2].toLowerCase()];
  }

  private calculateCpuPercent(stats: any): number {
    const cpuDelta =
      stats.cpu_stats.cpu_usage.total_usage -
      stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta =
      stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    return (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100;
  }
}
