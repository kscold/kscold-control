import { Injectable } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { IDockerCleanupGateway } from '../../domain/gateways/docker-cleanup.gateway.interface';
import { resolveDockerHost } from '../../../common/utils/docker-host.util';

const execFileAsync = promisify(execFile);

@Injectable()
export class DockerCleanupAdapter implements IDockerCleanupGateway {
  async getUsageSummary(): Promise<string> {
    return this.run(['system', 'df', '--format', '{{json .}}']);
  }

  async getDetailedUsage(): Promise<string> {
    return this.run(['system', 'df', '-v']);
  }

  async pruneDanglingImages(): Promise<string> {
    return this.run(['image', 'prune', '-f']);
  }

  async removeContainers(ids: string[]): Promise<string> {
    // container prune 은 일부러 꺼 둔 컨테이너까지 모두 지우므로 고른 것만 지운다(-v 없이 볼륨 유지).
    return this.run(['container', 'rm', ...ids]);
  }

  async pruneDanglingVolumes(): Promise<string> {
    return this.run(['volume', 'prune', '-f']);
  }

  async pruneBuildCache(): Promise<string> {
    return this.run(['builder', 'prune', '-f']);
  }

  /**
   * Docker 명령과 인수를 분리해 실행함.
   *
   * exec가 아닌 execFile을 쓰면 셸을 거치지 않아 공백·따옴표·환경 변수 확장에
   * 따른 명령 주입이 발생하지 않음. Docker 소켓은 프로세스 환경 변수로
   * 전달해 기존 Colima 기본 경로와 DOCKER_HOST 재정의도 모두 지원함.
   */
  private async run(args: readonly string[]): Promise<string> {
    const { stdout, stderr } = await execFileAsync('docker', [...args], {
      env: {
        ...process.env,
        DOCKER_HOST: resolveDockerHost(),
      },
      maxBuffer: 10 * 1024 * 1024,
    });

    return `${stdout}${stderr}`.trim();
  }
}
