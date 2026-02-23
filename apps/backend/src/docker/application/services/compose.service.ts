import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

// eslint-disable-next-line @typescript-eslint/no-var-requires
const yaml = require('js-yaml');

/**
 * Docker Compose project directory
 * This is where docker-compose.yml lives
 */
const COMPOSE_DIR = path.resolve(__dirname, '../../../../../');

export interface ComposeServiceConfig {
  name: string;
  image: string;
  ports: Record<string, number>; // { "22": 2224, "8080": 8083 }
  cpus: string; // e.g., "2"
  memLimit: string; // e.g., "4g"
  command?: string;
  environment?: Record<string, string>;
}

@Injectable()
export class ComposeService {
  private readonly logger = new Logger(ComposeService.name);
  private readonly composeFilePath = path.join(
    COMPOSE_DIR,
    'docker-compose.yml',
  );

  /**
   * Read and parse docker-compose.yml
   */
  readCompose(): any {
    const content = fs.readFileSync(this.composeFilePath, 'utf-8');
    return yaml.load(content);
  }

  /**
   * Write docker-compose.yml
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
   * List all services defined in docker-compose.yml
   */
  listServices(): string[] {
    const compose = this.readCompose();
    return Object.keys(compose.services || {});
  }

  /**
   * Add a new ubuntu instance service to docker-compose.yml
   */
  addService(config: ComposeServiceConfig): void {
    const compose = this.readCompose();

    if (compose.services?.[config.name]) {
      throw new Error(
        `Service "${config.name}" already exists in docker-compose.yml`,
      );
    }

    // Build port mappings array for compose format
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
   * Remove a service from docker-compose.yml
   */
  removeService(name: string): void {
    const compose = this.readCompose();

    if (!compose.services?.[name]) {
      throw new Error(`Service "${name}" not found in docker-compose.yml`);
    }

    // Prevent removing critical infrastructure services
    const protectedServices = ['nginx', 'kscold-infra-db'];
    if (protectedServices.includes(name)) {
      throw new Error(`Cannot remove protected service "${name}"`);
    }

    delete compose.services[name];

    // Also remove from depends_on of other services
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
   * Run docker compose up for a specific service
   */
  async upService(name: string): Promise<string> {
    try {
      const { stdout, stderr } = await execAsync(
        `docker compose -f "${this.composeFilePath}" up -d ${name}`,
        { cwd: COMPOSE_DIR },
      );
      this.logger.log(`Compose up for "${name}": ${stdout}`);
      return stdout + stderr;
    } catch (error) {
      this.logger.error(`Compose up failed for "${name}": ${error.message}`);
      throw error;
    }
  }

  /**
   * Run docker compose down for a specific service (stop + remove)
   */
  async downService(name: string): Promise<string> {
    try {
      const { stdout, stderr } = await execAsync(
        `docker compose -f "${this.composeFilePath}" stop ${name} && docker compose -f "${this.composeFilePath}" rm -f ${name}`,
        { cwd: COMPOSE_DIR },
      );
      return stdout + stderr;
    } catch (error) {
      this.logger.error(`Compose down failed for "${name}": ${error.message}`);
      throw error;
    }
  }

  /**
   * Get compose service info
   */
  getServiceConfig(name: string): any | null {
    const compose = this.readCompose();
    return compose.services?.[name] || null;
  }
}
