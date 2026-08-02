import { Injectable, OnModuleInit } from '@nestjs/common';
import Docker from 'dockerode';
import { PassThrough } from 'node:stream';
import {
  IDockerClient,
  DockerContainerInfo,
  DockerContainerStats,
  DockerContainerConfig,
  DockerContainerProcesses,
  DockerPm2Process,
  DockerDetectedService,
} from '../../domain/gateways/docker-client.gateway.interface';
import {
  DockerConnectionException,
  DockerOperationException,
} from '../../../common/exceptions';
import { ResourceConfig } from '../../domain/value-objects/resource-config.vo';
import { resolveDockerConnectionOptions } from '../lib/docker-host';

/**
 * Dockerode를 Docker 게이트웨이 계약으로 변환하는 인프라 어댑터임.
 *
 * 애플리케이션은 이 어댑터가 아닌 게이트웨이 인터페이스만 의존하므로 Docker 소켓,
 * Dockerode 응답 형태, 멀티플렉스 스트림 처리는 이 파일에 한정됨.
 */
@Injectable()
export class DockerodeClientAdapter implements IDockerClient, OnModuleInit {
  private docker: Docker;

  onModuleInit() {
    try {
      this.docker = new Docker(resolveDockerConnectionOptions());
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
      // 자원 제한은 Docker API 호출 전에 값 객체로 검증함.
      const resources = ResourceConfig.create(
        config.resources.cpus,
        config.resources.memory,
      );

      /*
       * 애플리케이션의 { 내부 포트: 호스트 포트 } 구조를 Docker API의
       * ExposedPorts와 HostConfig.PortBindings 두 표현으로 동시에 변환함.
       * 둘 중 하나만 설정하면 포트가 노출되지 않거나 호스트에 연결되지 않음.
       */
      const exposedPorts: Record<string, Record<string, never>> = {};
      const portBindings: Record<string, Array<{ HostPort: string }>> = {};

      Object.entries(config.ports).forEach(([internal, external]) => {
        const key = `${internal}/tcp`;
        exposedPorts[key] = {};
        portBindings[key] = [{ HostPort: external.toString() }];
      });

      // 검증·변환된 설정만 Docker 엔진에 전달함.
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
  ): Promise<DockerContainerProcesses> {
    const container = this.docker.getContainer(dockerId);
    const pm2List: DockerPm2Process[] = [];
    const services: DockerDetectedService[] = [];

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
      // PM2를 쓰지 않는 컨테이너는 정상적인 경우이므로 하위 목록만 비워 둠.
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
      // 최소 이미지에는 ps가 없을 수 있으므로 서비스 추론만 생략함.
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
      AttachStderr: true,
    });

    const stream = await exec.start({ hijack: true, stdin: false });

    return new Promise((resolve) => {
      const stdout = new PassThrough();
      const stderr = new PassThrough();
      const chunks: Buffer[] = [];
      let completed = false;

      const finish = () => {
        if (completed) {
          return;
        }

        completed = true;
        clearTimeout(timeout);
        resolve(Buffer.concat(chunks).toString('utf8'));
      };
      const timeout = setTimeout(finish, 5000);

      stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
      stderr.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.once('end', finish);
      stream.once('close', finish);
      stream.once('error', finish);

      /*
       * Docker exec 출력은 청크마다 8바이트 헤더가 항상 붙는 것이 아니라, 하나의
       * 멀티플렉스 프레임이 여러 청크로 나뉘거나 여러 프레임이 합쳐질 수 있음.
       * 직접 slice(8) 하면 긴 출력의 일부가 사라질 수 있으므로 Dockerode가 제공하는
       * demuxStream으로 stdout·stderr 프레임을 올바르게 분리함.
       */
      this.docker.modem.demuxStream(stream, stdout, stderr);
    });
  }

  // Docker 통계 응답을 화면용 수치로 정규화하는 보조 메서드임.

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
