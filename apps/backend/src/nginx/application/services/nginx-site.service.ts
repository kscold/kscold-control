import {
  BadRequestException,
  Injectable,
  Inject,
  Logger,
} from '@nestjs/common';
import {
  NGINX_CONFIG_REPOSITORY,
  type INginxConfigRepository,
} from '../../domain/repositories/nginx-config.repository';
import {
  NGINX_RUNTIME_REPOSITORY,
  type INginxRuntimeRepository,
} from '../../domain/repositories/nginx-runtime.repository';
import type {
  NginxSite,
  NginxSiteConfiguration,
} from '../../domain/types/nginx-site.type';
import { CreateNginxSiteDto } from '../dto';

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
    const configuration = this.validateAndNormalizeInput(dto);
    // 기존 설정 존재 여부는 파일 쓰기 전에 확인해야 덮어쓰기를 막을 수 있음.
    const existing = this.configRepo.read(configuration.name);
    if (existing) {
      throw new Error(`Site "${configuration.name}" already exists`);
    }

    const site = this.configRepo.write(configuration.name, configuration);
    const testResult = await this.autoTestAndReload();
    return { ...site, testResult };
  }

  async updateSite(
    name: string,
    dto: CreateNginxSiteDto,
  ): Promise<NginxSite & { testResult: { success: boolean; output: string } }> {
    this.assertSafeSiteName(name);
    const site = this.configRepo.write(
      name,
      this.validateAndNormalizeInput(CreateNginxSiteDto.from({ ...dto, name })),
    );
    const testResult = await this.autoTestAndReload();
    return { ...site, testResult };
  }

  async deleteSite(name: string): Promise<{
    success: boolean;
    testResult: { success: boolean; output: string };
  }> {
    this.assertSafeSiteName(name);
    this.configRepo.delete(name);
    const testResult = await this.autoTestAndReload();
    return { success: true, testResult };
  }

  async toggleSite(name: string): Promise<{
    enabled: boolean;
    testResult: { success: boolean; output: string };
  }> {
    this.assertSafeSiteName(name);
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

  private validateAndNormalizeInput(
    dto: CreateNginxSiteDto,
  ): NginxSiteConfiguration {
    const normalized: NginxSiteConfiguration = {
      ...dto,
      name: dto.name.trim(),
      domain: dto.domain.trim(),
      upstream: dto.upstream.trim(),
      sslCert: dto.sslCert?.trim() ?? '',
      sslKey: dto.sslKey?.trim() ?? '',
    };

    this.assertSafeSiteName(normalized.name);
    if (
      !normalized.domain ||
      !/^[A-Za-z0-9*_.-]+$/.test(normalized.domain) ||
      normalized.domain.includes('..')
    ) {
      throw new BadRequestException('도메인 형식이 올바르지 않습니다.');
    }

    if (/[[\]{};\r\n\s]/.test(normalized.upstream)) {
      throw new BadRequestException(
        'upstream 값에 허용되지 않는 문자가 있습니다.',
      );
    }

    try {
      const upstream = new URL(normalized.upstream);
      if (
        !['http:', 'https:'].includes(upstream.protocol) ||
        !upstream.hostname ||
        upstream.username ||
        upstream.password
      ) {
        throw new Error('invalid upstream');
      }
    } catch {
      throw new BadRequestException(
        'upstream은 http 또는 https URL이어야 합니다.',
      );
    }

    for (const [label, value] of [
      ['sslCert', normalized.sslCert],
      ['sslKey', normalized.sslKey],
    ] as const) {
      if (value && (!value.startsWith('/') || /[\r\n;{}\s]/.test(value))) {
        throw new BadRequestException(`${label} 경로가 올바르지 않습니다.`);
      }
    }

    return normalized;
  }

  private assertSafeSiteName(name: string): void {
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,62}$/.test(name)) {
      throw new BadRequestException('사이트 이름이 올바르지 않습니다.');
    }
  }
}
