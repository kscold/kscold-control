import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  NGINX_CONFIG_REPOSITORY,
  type INginxConfigRepository,
} from '../../domain/interfaces/nginx-config.repository';
import {
  NGINX_RUNTIME_REPOSITORY,
  type INginxRuntimeRepository,
} from '../../domain/interfaces/nginx-runtime.repository';
import type {
  NginxSite,
  CreateNginxSiteDto,
} from '../../domain/types/nginx-site.type';

@Injectable()
export class NginxSiteService {
  private readonly logger = new Logger(NginxSiteService.name);

  constructor(
    @Inject(NGINX_CONFIG_REPOSITORY)
    private readonly configRepo: INginxConfigRepository,
    @Inject(NGINX_RUNTIME_REPOSITORY)
    private readonly runtimeRepo: INginxRuntimeRepository,
  ) {}

  async listSites(): Promise<NginxSite[]> {
    return this.configRepo.list();
  }

  async createSite(
    dto: CreateNginxSiteDto,
  ): Promise<NginxSite & { testResult: { success: boolean; output: string } }> {
    // Check if site already exists
    const existing = this.configRepo.read(dto.name);
    if (existing) {
      throw new Error(`Site "${dto.name}" already exists`);
    }

    const site = this.configRepo.write(dto.name, dto);
    const testResult = await this.autoTestAndReload();
    return { ...site, testResult };
  }

  async updateSite(
    name: string,
    dto: CreateNginxSiteDto,
  ): Promise<NginxSite & { testResult: { success: boolean; output: string } }> {
    const site = this.configRepo.write(name, dto);
    const testResult = await this.autoTestAndReload();
    return { ...site, testResult };
  }

  async deleteSite(
    name: string,
  ): Promise<{
    success: boolean;
    testResult: { success: boolean; output: string };
  }> {
    this.configRepo.delete(name);
    const testResult = await this.autoTestAndReload();
    return { success: true, testResult };
  }

  async toggleSite(
    name: string,
  ): Promise<{
    enabled: boolean;
    testResult: { success: boolean; output: string };
  }> {
    const result = this.configRepo.toggle(name);
    const testResult = await this.autoTestAndReload();
    return { ...result, testResult };
  }

  async testConfig(): Promise<{ success: boolean; output: string }> {
    return this.runtimeRepo.testConfig();
  }

  async reloadNginx(): Promise<{ success: boolean; output: string }> {
    return this.runtimeRepo.reload();
  }

  private async autoTestAndReload(): Promise<{
    success: boolean;
    output: string;
  }> {
    const testResult = await this.runtimeRepo.testConfig();
    if (testResult.success) {
      await this.runtimeRepo.reload();
    }
    return testResult;
  }
}
