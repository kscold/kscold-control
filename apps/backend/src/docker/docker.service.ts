import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Docker from 'dockerode';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Container } from '../entities/container.entity';
import { PortForwardingService } from './port-forwarding.service';

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
export class DockerService implements OnModuleInit, OnModuleDestroy {
  private docker: Docker;

  constructor(
    @InjectRepository(Container)
    private containerRepo: Repository<Container>,
    private portForwardingService: PortForwardingService,
  ) {}

  onModuleInit() {
    const socketPath =
      process.env.DOCKER_HOST?.replace('unix://', '') ||
      '/var/run/docker.sock';
    this.docker = new Docker({ socketPath });
  }

  async onModuleDestroy() {
    // UPnP 클라이언트 정리
    await this.portForwardingService.close();
  }

  /**
   * 컨테이너 목록 조회 (Docker에서 직접 가져오기)
   */
  async listContainers(userId?: string) {
    // Docker에서 모든 컨테이너 가져오기
    const dockerContainers = await this.docker.listContainers({ all: true });

    // DB 컨테이너 가져오기
    const dbContainers = userId
      ? await this.containerRepo.find({ where: { userId } })
      : await this.containerRepo.find();

    // Docker 컨테이너를 기준으로 목록 생성
    const containerPromises = dockerContainers.map(async (dc) => {
      const dbContainer = dbContainers.find((dbc) =>
        dc.Id.startsWith(dbc.dockerId),
      );

      // 포트 매핑 파싱
      const ports: Record<string, number> = {};
      dc.Ports.forEach((p) => {
        if (p.PublicPort && p.PrivatePort) {
          ports[p.PrivatePort.toString()] = p.PublicPort;
        }
      });

      // Docker inspect를 사용하여 실제 리소스 정보 가져오기
      let resources = dbContainer?.resources || { cpus: 0, memory: '0' };

      try {
        const dockerContainer = this.docker.getContainer(dc.Id);
        const inspectData = await dockerContainer.inspect();

        // NanoCPUs를 cores로 변환
        const nanoCpus = inspectData.HostConfig?.NanoCpus || 0;
        const cpus = nanoCpus > 0 ? nanoCpus / 1e9 : 0;

        // Memory를 human readable 형식으로 변환
        const memoryBytes = inspectData.HostConfig?.Memory || 0;
        const memory = memoryBytes > 0 ? this.formatMemory(memoryBytes) : '0';

        resources = { cpus, memory };
      } catch (error) {
        console.error(`Failed to inspect container ${dc.Id}:`, error);
      }

      // 외부 접속 정보 추가
      const externalAccess = this.portForwardingService.getExternalAccess(
        dbContainer?.ports || ports,
      );

      return {
        id: dbContainer?.id || dc.Id,
        dockerId: dc.Id,
        name: dc.Names[0].replace('/', ''),
        image: dc.Image,
        status: dbContainer?.status || dc.Status,
        liveStatus: dc.State,
        ports: dbContainer?.ports || ports,
        resources,
        createdAt: dbContainer?.createdAt || new Date(dc.Created * 1000),
        userId: dbContainer?.userId || null,
        externalAccess, // 외부 접속 정보
      };
    });

    return Promise.all(containerPromises);
  }

  /**
   * 컨테이너 생성 (우분투 템플릿)
   */
  async createContainer(dto: CreateContainerDto) {
    // 이미지가 없으면 자동으로 pull
    try {
      await this.docker.getImage(dto.image).inspect();
    } catch (error) {
      console.log(`[Docker] Image ${dto.image} not found, pulling...`);
      await new Promise((resolve, reject) => {
        this.docker.pull(dto.image, (err: any, stream: any) => {
          if (err) return reject(err);
          this.docker.modem.followProgress(stream, (err: any, output: any) => {
            if (err) return reject(err);
            console.log(`[Docker] Successfully pulled ${dto.image}`);
            resolve(output);
          });
        });
      });
    }

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

    // 컨테이너 자동 시작
    await container.start();
    dbContainer.status = 'running';
    await this.containerRepo.save(dbContainer);

    // 포트포워딩 규칙 추가 (백그라운드에서 비동기 실행)
    this.addPortForwardingRules(dto.name, dto.ports);

    return { container: dbContainer, dockerId: container.id };
  }

  /**
   * 포트포워딩 규칙 추가 (비동기)
   */
  private async addPortForwardingRules(
    containerName: string,
    ports: Record<string, number>,
  ) {
    for (const [internalPort, externalPort] of Object.entries(ports)) {
      await this.portForwardingService.addPortMapping(
        parseInt(internalPort),
        externalPort,
        `${containerName}-port-${internalPort}`,
      );
    }
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

    // 포트포워딩 규칙 제거
    if (container.ports) {
      for (const externalPort of Object.values(container.ports)) {
        await this.portForwardingService.removePortMapping(externalPort);
      }
    }

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

  /**
   * 컨테이너 내부 프로세스 조회 (PM2 + 시스템 서비스)
   */
  async getContainerProcesses(
    dockerId: string,
  ): Promise<{ pm2: any[]; services: any[] }> {
    const container = this.docker.getContainer(dockerId);
    const pm2List: any[] = [];
    const services: any[] = [];

    try {
      // PM2 프로세스 목록 가져오기
      const pm2Json = await this.execCommand(container, [
        'sh',
        '-c',
        'pm2 jlist 2>/dev/null || echo "[]"',
      ]);
      const parsed = JSON.parse(pm2Json.trim() || '[]');
      for (const p of parsed) {
        pm2List.push({
          name: p.name,
          status: p.pm2_env?.status || 'unknown',
          pid: p.pid,
          cpu: p.monit?.cpu ?? 0,
          memory: p.monit?.memory ?? 0,
          restarts: p.pm2_env?.restart_time ?? 0,
          uptime: p.pm2_env?.pm_uptime ?? null,
        });
      }
    } catch {
      // PM2 없는 컨테이너
    }

    try {
      // ps aux로 시스템 서비스 감지
      const ps = await this.execCommand(container, [
        'sh',
        '-c',
        'ps aux 2>/dev/null || ps 2>/dev/null || echo ""',
      ]);
      if (/postgres/.test(ps)) services.push({ name: 'PostgreSQL', port: 5432, icon: 'pg' });
      if (/redis-server/.test(ps)) services.push({ name: 'Redis', port: 6379, icon: 'redis' });
      if (/mongod/.test(ps)) services.push({ name: 'MongoDB', port: 27017, icon: 'mongo' });
      if (/mysqld/.test(ps)) services.push({ name: 'MySQL', port: 3306, icon: 'mysql' });
      if (/nginx/.test(ps)) services.push({ name: 'Nginx', port: 80, icon: 'nginx' });
      if (/sshd/.test(ps)) services.push({ name: 'SSH', port: 22, icon: 'ssh' });
    } catch {
      // ps 실패 무시
    }

    return { pm2: pm2List, services };
  }

  /**
   * 컨테이너 내부에서 커맨드 실행 후 stdout 반환
   */
  private async execCommand(container: Docker.Container, cmd: string[]): Promise<string> {
    const exec = await container.exec({
      Cmd: cmd,
      AttachStdout: true,
      AttachStderr: false,
    });

    const stream = await exec.start({ hijack: true, stdin: false });

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => {
        // dockerode multiplexing header: first 8 bytes are header
        const data = chunk.length > 8 ? chunk.slice(8) : chunk;
        chunks.push(data);
      });
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      stream.on('error', reject);
      setTimeout(() => resolve(Buffer.concat(chunks).toString('utf8')), 5000);
    });
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

  private formatMemory(bytes: number): string {
    if (bytes === 0) return '0';
    const gb = bytes / 1024 ** 3;
    if (gb >= 1) return `${gb.toFixed(1)}g`;
    const mb = bytes / 1024 ** 2;
    if (mb >= 1) return `${mb.toFixed(0)}m`;
    const kb = bytes / 1024;
    if (kb >= 1) return `${kb.toFixed(0)}k`;
    return `${bytes}b`;
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
