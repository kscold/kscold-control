import { Injectable, OnModuleInit } from '@nestjs/common';
import Docker from 'dockerode';
import {
  IDockerClient,
  DockerContainerInfo,
  DockerContainerStats,
  DockerContainerConfig,
} from '../../domain/repositories/docker-client.interface';
import {
  DockerConnectionException,
  DockerOperationException,
} from '../../../common/exceptions';
import { ResourceConfig } from '../../domain/value-objects/resource-config.vo';

/**
 * Dockerode Client Adapter
 * Wraps Dockerode to implement IDockerClient interface
 */
@Injectable()
export class DockerodeClientAdapter implements IDockerClient, OnModuleInit {
  private docker: Docker;

  onModuleInit() {
    try {
      const socketPath =
        process.env.DOCKER_HOST?.replace('unix://', '') ||
        '/var/run/docker.sock';
      this.docker = new Docker({ socketPath });
    } catch (error) {
      throw new DockerConnectionException(error.message);
    }
  }

  async listContainers(all: boolean = true): Promise<DockerContainerInfo[]> {
    try {
      const containers = await this.docker.listContainers({ all });

      return containers.map((c) => ({
        id: c.Id,
        name: c.Names[0]?.replace('/', '') || '',
        image: c.Image,
        state: c.State,
        status: c.Status,
        ports: c.Ports.map((p) => ({
          privatePort: p.PrivatePort,
          publicPort: p.PublicPort,
          type: p.Type,
        })),
        created: c.Created,
      }));
    } catch (error) {
      throw new DockerOperationException('list containers', error.message);
    }
  }

  async createContainer(config: DockerContainerConfig): Promise<string> {
    try {
      // Validate resources
      const resources = ResourceConfig.create(
        config.resources.cpus,
        config.resources.memory,
      );

      // Map ports for Docker
      const exposedPorts: Record<string, {}> = {};
      const portBindings: Record<string, Array<{ HostPort: string }>> = {};

      Object.entries(config.ports).forEach(([internal, external]) => {
        const key = `${internal}/tcp`;
        exposedPorts[key] = {};
        portBindings[key] = [{ HostPort: external.toString() }];
      });

      // Create container
      const container = await this.docker.createContainer({
        name: config.name,
        Image: config.image,
        ExposedPorts: exposedPorts,
        Env: config.environment
          ? Object.entries(config.environment).map(([k, v]) => `${k}=${v}`)
          : [],
        HostConfig: {
          PortBindings: portBindings,
          NanoCpus: resources.toNanoCpus(),
          Memory: resources.toBytes(),
        },
      });

      return container.id;
    } catch (error) {
      throw new DockerOperationException('create container', error.message);
    }
  }

  async startContainer(dockerId: string): Promise<void> {
    try {
      const container = this.docker.getContainer(dockerId);
      await container.start();
    } catch (error) {
      throw new DockerOperationException('start container', error.message);
    }
  }

  async stopContainer(dockerId: string): Promise<void> {
    try {
      const container = this.docker.getContainer(dockerId);
      await container.stop();
    } catch (error) {
      throw new DockerOperationException('stop container', error.message);
    }
  }

  async removeContainer(dockerId: string): Promise<void> {
    try {
      const container = this.docker.getContainer(dockerId);
      await container.remove({ force: true });
    } catch (error) {
      throw new DockerOperationException('remove container', error.message);
    }
  }

  async getStats(dockerId: string): Promise<DockerContainerStats> {
    try {
      const container = this.docker.getContainer(dockerId);
      const stats = await container.stats({ stream: false });

      return {
        cpuUsage: this.calculateCpuUsage(stats),
        memoryUsage: stats.memory_stats.usage || 0,
        memoryLimit: stats.memory_stats.limit || 0,
        networkIn: this.calculateNetworkIn(stats),
        networkOut: this.calculateNetworkOut(stats),
      };
    } catch (error) {
      throw new DockerOperationException('get stats', error.message);
    }
  }

  async getLogs(dockerId: string, lines: number = 100): Promise<string[]> {
    try {
      const container = this.docker.getContainer(dockerId);
      const logs = await container.logs({
        stdout: true,
        stderr: true,
        tail: lines,
      });

      return logs
        .toString()
        .split('\n')
        .filter((line) => line.trim().length > 0);
    } catch (error) {
      throw new DockerOperationException('get logs', error.message);
    }
  }

  async pullImage(image: string): Promise<void> {
    try {
      await new Promise<void>((resolve, reject) => {
        this.docker.pull(image, (err: Error, stream: any) => {
          if (err) {
            reject(err);
            return;
          }

          this.docker.modem.followProgress(stream, (err: Error) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        });
      });
    } catch (error) {
      throw new DockerOperationException('pull image', error.message);
    }
  }

  async inspectContainer(dockerId: string): Promise<any> {
    try {
      const container = this.docker.getContainer(dockerId);
      return await container.inspect();
    } catch (error) {
      throw new DockerOperationException('inspect container', error.message);
    }
  }

  async getContainerProcesses(
    dockerId: string,
  ): Promise<{ pm2: any[]; services: any[] }> {
    const container = this.docker.getContainer(dockerId);
    const pm2List: any[] = [];
    const services: any[] = [];

    try {
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
        });
      }
    } catch {
      // PM2 없는 컨테이너
    }

    try {
      const ps = await this.execCommand(container, [
        'sh',
        '-c',
        'ps aux 2>/dev/null || ps 2>/dev/null || echo ""',
      ]);
      if (/postgres/.test(ps))
        services.push({ name: 'PostgreSQL', port: 5432, icon: 'pg' });
      if (/redis-server/.test(ps))
        services.push({ name: 'Redis', port: 6379, icon: 'redis' });
      if (/mongod/.test(ps))
        services.push({ name: 'MongoDB', port: 27017, icon: 'mongo' });
      if (/mysqld/.test(ps))
        services.push({ name: 'MySQL', port: 3306, icon: 'mysql' });
      if (/nginx/.test(ps))
        services.push({ name: 'Nginx', port: 80, icon: 'nginx' });
      if (/sshd/.test(ps))
        services.push({ name: 'SSH', port: 22, icon: 'ssh' });
    } catch {
      // ps 실패 무시
    }

    return { pm2: pm2List, services };
  }

  private async execCommand(
    container: Docker.Container,
    cmd: string[],
  ): Promise<string> {
    const exec = await container.exec({
      Cmd: cmd,
      AttachStdout: true,
      AttachStderr: false,
    });

    const stream = await exec.start({ hijack: true, stdin: false });

    return new Promise((resolve) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => {
        const data = chunk.length > 8 ? chunk.slice(8) : chunk;
        chunks.push(data);
      });
      stream.on('end', () =>
        resolve(Buffer.concat(chunks).toString('utf8')),
      );
      stream.on('error', () =>
        resolve(Buffer.concat(chunks).toString('utf8')),
      );
      setTimeout(
        () => resolve(Buffer.concat(chunks).toString('utf8')),
        5000,
      );
    });
  }

  // Helper methods

  private calculateCpuUsage(stats: any): number {
    const cpuDelta =
      stats.cpu_stats.cpu_usage.total_usage -
      stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta =
      stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    const cpuCount = stats.cpu_stats.online_cpus || 1;

    if (systemDelta > 0 && cpuDelta > 0) {
      return (cpuDelta / systemDelta) * cpuCount * 100;
    }
    return 0;
  }

  private calculateNetworkIn(stats: any): number {
    if (!stats.networks) return 0;
    return Object.values(stats.networks).reduce(
      (acc: number, network: any) => acc + (network.rx_bytes || 0),
      0,
    ) as number;
  }

  private calculateNetworkOut(stats: any): number {
    if (!stats.networks) return 0;
    return Object.values(stats.networks).reduce(
      (acc: number, network: any) => acc + (network.tx_bytes || 0),
      0,
    ) as number;
  }
}
