import { Injectable } from '@nestjs/common';
import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';
import type { IComposeRuntimeGateway } from '../../domain/gateways/compose-runtime.gateway.interface';
import type { ComposeDocument } from '../../domain/types/compose.type';
import { resolveDockerHost } from '../lib/docker-host';
import { resolveDockerProjectRoot } from '../lib/docker-project-root';

const execFileAsync = promisify(execFile);
const yaml = require('js-yaml');

@Injectable()
export class DockerComposeRuntimeAdapter implements IComposeRuntimeGateway {
  private readonly projectRoot = resolveDockerProjectRoot(__dirname);
  private readonly composeFilePath = path.join(
    this.projectRoot,
    'docker-compose.yml',
  );

  readCompose(): ComposeDocument {
    const content = fs.readFileSync(this.composeFilePath, 'utf8');
    const compose = yaml.load(content) ?? {};

    if (
      compose === null ||
      typeof compose !== 'object' ||
      Array.isArray(compose)
    ) {
      throw new Error('docker-compose.yml의 최상위 구조가 객체가 아닙니다.');
    }

    return compose as ComposeDocument;
  }

  writeCompose(compose: ComposeDocument): void {
    const content = yaml.dump(compose, {
      indent: 2,
      lineWidth: 120,
      noRefs: true,
      sortKeys: false,
    });
    const temporaryFilePath = `${this.composeFilePath}.${process.pid}.${Date.now()}.tmp`;

    /*
     * Compose 서비스 생성은 read -> 정책 변경 -> write 순서로 이루어짐.
     * 대상 파일에 바로 쓰면 프로세스 종료나 디스크 오류 때 YAML이 반쯤 기록될 수
     * 있으므로, 같은 디렉터리에 임시 파일을 완성한 뒤 rename으로 교체함.
     * 같은 파일 시스템 안의 rename은 원자적으로 동작해 기존 파일 또는 새 파일 중
     * 하나만 보이게 함.
     */
    try {
      fs.writeFileSync(temporaryFilePath, content, 'utf8');
      fs.renameSync(temporaryFilePath, this.composeFilePath);
    } finally {
      if (fs.existsSync(temporaryFilePath)) {
        fs.unlinkSync(temporaryFilePath);
      }
    }
  }

  async listDockerHostPorts(): Promise<number[]> {
    const { stdout } = await execFileAsync(
      'docker',
      ['ps', '-a', '--format', '{{.Ports}}'],
      {
        cwd: this.projectRoot,
        env: {
          ...process.env,
          DOCKER_HOST: resolveDockerHost(),
        },
      },
    );
    const ports: number[] = [];

    /*
     * docker ps의 Ports 열은 "0.0.0.0:8080->80/tcp"처럼 주소와 프로토콜이
     * 섞인 표시 문자열임. 화살표 앞의 마지막 포트만 수집해 IPv4·IPv6
     * 표기와 무관하게 실제 호스트 바인딩 얻음.
     */
    for (const line of stdout.split('\n')) {
      const matches = line.matchAll(/:(\d+)->/g);
      for (const match of matches) {
        const port = Number.parseInt(match[1], 10);
        if (Number.isFinite(port)) {
          ports.push(port);
        }
      }
    }

    return ports;
  }

  async upService(name: string): Promise<string> {
    return this.runCompose(['up', '-d', name]);
  }

  async downService(name: string): Promise<string> {
    return this.runCompose(['rm', '-f', '-s', name]);
  }

  private async runCompose(args: string[]): Promise<string> {
    /*
     * 서비스 이름은 애플리케이션에서 허용 문자로 검증하지만, 여기서도 셸을 거치지
     * 않고 실행 파일과 인수를 분리함. Compose 파일 경로에 공백이 있어도
     * 하나의 인수로 전달되므로 문자열 조합에 따른 오작동이나 주입이 없음.
     */
    const { stdout, stderr } = await execFileAsync(
      'docker',
      ['compose', '-f', this.composeFilePath, ...args],
      {
        cwd: this.projectRoot,
        env: {
          ...process.env,
          DOCKER_HOST: resolveDockerHost(),
        },
      },
    );
    return `${stdout}${stderr}`;
  }
}
