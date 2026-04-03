import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { resolveDockerProjectRoot } from './docker-project-path.util';

const execAsync = promisify(exec);

// eslint-disable-next-line @typescript-eslint/no-var-requires
const yaml = require('js-yaml');

/**
 * docker-compose 서비스 생성에 쓰는 설정입니다.
 */
export interface ComposeServiceConfig {
  name: string;
  image: string;
  ports: Record<string, number>; // { "22": 2224, "8080": 8083 }
  cpus: string; // 예: "2"
  memLimit: string; // 예: "4g"
  command?: string;
  environment?: Record<string, string>;
}

@Injectable()
export class ComposeService {
  private readonly logger = new Logger(ComposeService.name);
  private readonly projectRoot = resolveDockerProjectRoot(__dirname);
  private readonly composeFilePath = path.join(this.projectRoot, 'docker-compose.yml');

  /**
   * docker-compose.yml을 읽어 파싱합니다.
   */
  readCompose(): any {
    const content = fs.readFileSync(this.composeFilePath, 'utf-8');
    return yaml.load(content);
  }

  /**
   * docker-compose.yml을 저장합니다.
   */
  private writeCompose(data: any): void {
    const content = yaml.dump(data, {
      indent: 2,
      lineWidth: 120,
      noRefs: true,
      sortKeys: false,
    });
    fs.writeFileSync(this.composeFilePath, content, 'utf-8');
  }

  /**
   * compose에 정의된 서비스 목록을 반환합니다.
   */
  listServices(): string[] {
    const compose = this.readCompose();
    return Object.keys(compose.services || {});
  }

  /**
   * 새 서비스를 docker-compose.yml에 추가합니다.
   */
  addService(config: ComposeServiceConfig): void {
    const compose = this.readCompose();

    if (compose.services?.[config.name]) {
      throw new Error(
        `Service "${config.name}" already exists in docker-compose.yml`,
      );
    }

    // compose 형식에 맞춰 포트 매핑 배열을 생성합니다.
    const ports: string[] = [];
    for (const [internal, external] of Object.entries(config.ports)) {
      ports.push(`${external}:${internal}`);
    }

    const service: any = {
      image: config.image,
      container_name: config.name,
      command: config.command || 'sleep infinity',
      ports,
      cpus: config.cpus,
      mem_limit: config.memLimit,
      restart: 'unless-stopped',
    };

    if (config.environment && Object.keys(config.environment).length > 0) {
      service.environment = config.environment;
    }

    compose.services[config.name] = service;

    this.writeCompose(compose);
    this.logger.log(`Added service "${config.name}" to docker-compose.yml`);
  }

  /**
   * docker-compose.yml에서 서비스를 제거합니다.
   */
  removeService(name: string): void {
    const compose = this.readCompose();

    if (!compose.services?.[name]) {
      throw new Error(`Service "${name}" not found in docker-compose.yml`);
    }

    // 핵심 인프라 서비스는 제거하지 못하게 막습니다.
    const protectedServices = ['nginx', 'kscold-infra-db'];
    if (protectedServices.includes(name)) {
      throw new Error(`Cannot remove protected service "${name}"`);
    }

    delete compose.services[name];

    // 다른 서비스의 depends_on에서도 함께 정리합니다.
    for (const svc of Object.values(compose.services) as any[]) {
      if (Array.isArray(svc.depends_on)) {
        svc.depends_on = svc.depends_on.filter((dep: string) => dep !== name);
        if (svc.depends_on.length === 0) delete svc.depends_on;
      }
    }

    this.writeCompose(compose);
    this.logger.log(`Removed service "${name}" from docker-compose.yml`);
  }

  /**
   * 특정 서비스를 docker compose up으로 기동합니다.
   */
  async upService(name: string): Promise<string> {
    try {
      const { stdout, stderr } = await execAsync(
        `docker compose -f "${this.composeFilePath}" up -d ${name}`,
        { cwd: this.projectRoot },
      );
      this.logger.log(`Compose up for "${name}": ${stdout}`);
      return stdout + stderr;
    } catch (error) {
      this.logger.error(`Compose up failed for "${name}": ${error.message}`);
      throw error;
    }
  }

  /**
   * 특정 서비스를 중지하고 compose에서 제거합니다.
   */
  async downService(name: string): Promise<string> {
    try {
      const { stdout, stderr } = await execAsync(
        `docker compose -f "${this.composeFilePath}" stop ${name} && docker compose -f "${this.composeFilePath}" rm -f ${name}`,
        { cwd: this.projectRoot },
      );
      return stdout + stderr;
    } catch (error) {
      this.logger.error(`Compose down failed for "${name}": ${error.message}`);
      throw error;
    }
  }

  /**
   * 특정 서비스의 compose 설정을 반환합니다.
   */
  getServiceConfig(name: string): any | null {
    const compose = this.readCompose();
    return compose.services?.[name] || null;
  }
}
