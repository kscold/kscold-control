import { Inject, Injectable, Logger } from '@nestjs/common';
import { ComposeService } from './compose.service';
import type {
  DockerCleanupCandidateItem,
  DockerCleanupCandidates,
  DockerCleanupCategory,
  DockerCleanupResult,
} from '../../domain/types/docker-cleanup.type';
import {
  parseDockerSizeToBytes,
  parseDockerSystemDfOutput,
} from '../../../common/utils/docker-disk-usage.util';
import {
  DOCKER_CLIENT,
  type IDockerClient,
} from '../../domain/gateways/docker-client.gateway.interface';
import {
  DOCKER_CLEANUP_GATEWAY,
  type IDockerCleanupGateway,
} from '../../domain/gateways/docker-cleanup.gateway.interface';
import {
  DOCKER_ARTIFACT_GATEWAY,
  type IDockerArtifactGateway,
} from '../../domain/gateways/docker-artifact.gateway.interface';

const ARTIFACT_PATHS = [
  'apps/backend/dist',
  'apps/frontend/dist',
  'apps/frontend/.next',
  'apps/frontend/standalone',
  'release',
];

interface ParsedDfSections {
  images: DockerCleanupCandidateItem[];
  containers: DockerCleanupCandidateItem[];
  volumes: DockerCleanupCandidateItem[];
  buildCache: DockerCleanupCandidateItem[];
}

@Injectable()
export class DockerCleanupService {
  private readonly logger = new Logger(DockerCleanupService.name);

  constructor(
    private readonly composeService: ComposeService,
    @Inject(DOCKER_CLEANUP_GATEWAY)
    private readonly dockerCleanupGateway: IDockerCleanupGateway,
    @Inject(DOCKER_ARTIFACT_GATEWAY)
    private readonly dockerArtifactGateway: IDockerArtifactGateway,
    @Inject(DOCKER_CLIENT) private readonly dockerClient: IDockerClient,
  ) {}

  async getCandidates(): Promise<DockerCleanupCandidates> {
    const [dockerDfOutput, detailedDfOutput, orphanCandidates, artifactFiles] =
      await Promise.all([
        this.collectSafely(
          'Docker 요약 사용량',
          () => this.dockerCleanupGateway.getUsageSummary(),
          '',
        ),
        this.collectSafely(
          'Docker 상세 사용량',
          () => this.dockerCleanupGateway.getDetailedUsage(),
          '',
        ),
        this.collectSafely(
          'Compose orphan 후보',
          () => this.collectComposeOrphans(),
          [] as DockerCleanupCandidateItem[],
        ),
        this.collectSafely(
          '배포 부산물 파일',
          () => this.dockerArtifactGateway.listArtifacts(ARTIFACT_PATHS),
          [] as DockerCleanupCandidateItem[],
        ),
      ]);

    const warnings = [
      dockerDfOutput.warning,
      detailedDfOutput.warning,
      orphanCandidates.warning,
      artifactFiles.warning,
    ].filter((warning): warning is string => Boolean(warning));

    const usage = parseDockerSystemDfOutput(dockerDfOutput.value);
    const sections = this.parseDetailedDfOutput(detailedDfOutput.value);

    const images = this.toCategory(
      sections.images.filter((item) => item.label === '<none>:<none>'),
    );
    const containers = this.toCategory(
      sections.containers.filter((item) =>
        item.state?.toLowerCase().startsWith('exited'),
      ),
    );
    const volumes = this.toCategory(
      sections.volumes.filter((item) => item.detail === '0 links'),
    );
    const buildCache = this.toCategory(
      sections.buildCache,
      usage.buildCache.reclaimable,
    );
    const composeOrphans = this.toCategory(orphanCandidates.value, 0);
    const artifacts = this.toCategory(
      artifactFiles.value.map((item) => ({ ...item, readOnly: true })),
      0,
    );

    return {
      images,
      containers,
      volumes,
      buildCache,
      composeOrphans,
      artifactFiles: artifacts,
      summary: {
        reclaimableBytes:
          images.reclaimableBytes +
          containers.reclaimableBytes +
          volumes.reclaimableBytes +
          buildCache.reclaimableBytes,
        readOnlyBytes: composeOrphans.totalBytes + artifacts.totalBytes,
        totalCandidates:
          images.items.length +
          containers.items.length +
          volumes.items.length +
          buildCache.items.length +
          composeOrphans.items.length +
          artifacts.items.length,
        warningCount: warnings.length,
      },
      warnings,
    };
  }

  async pruneDanglingImages(
    dryRun: boolean = true,
  ): Promise<DockerCleanupResult> {
    const candidates = (await this.getCandidates()).images.items;
    if (dryRun) {
      return this.createDryRunResult(candidates);
    }

    const output = await this.dockerCleanupGateway.pruneDanglingImages();
    return this.createExecResult(candidates, output);
  }

  async pruneExitedContainers(
    dryRun: boolean = true,
  ): Promise<DockerCleanupResult> {
    const candidates = (await this.getCandidates()).containers.items;
    if (dryRun) {
      return this.createDryRunResult(candidates);
    }

    const output = await this.dockerCleanupGateway.pruneExitedContainers();
    return this.createExecResult(candidates, output);
  }

  async pruneDanglingVolumes(
    dryRun: boolean = true,
  ): Promise<DockerCleanupResult> {
    const candidates = (await this.getCandidates()).volumes.items;
    if (dryRun) {
      return this.createDryRunResult(candidates);
    }

    const output = await this.dockerCleanupGateway.pruneDanglingVolumes();
    return this.createExecResult(candidates, output);
  }

  async pruneBuildCache(dryRun: boolean = true): Promise<DockerCleanupResult> {
    const category = (await this.getCandidates()).buildCache;
    if (dryRun) {
      return {
        success: true,
        dryRun: true,
        reclaimedBytes: category.reclaimableBytes,
        removedCount: category.items.length,
        items: category.items,
      };
    }

    const output = await this.dockerCleanupGateway.pruneBuildCache();
    return this.createExecResult(
      category.items,
      output,
      category.reclaimableBytes,
    );
  }

  private toCategory(
    items: DockerCleanupCandidateItem[],
    reclaimableBytes?: number,
  ): DockerCleanupCategory {
    return {
      items,
      totalBytes: items.reduce((sum, item) => sum + item.size, 0),
      reclaimableBytes:
        reclaimableBytes ??
        items.reduce((sum, item) => sum + (item.reclaimable ?? item.size), 0),
    };
  }

  private createDryRunResult(
    items: DockerCleanupCandidateItem[],
  ): DockerCleanupResult {
    return {
      success: true,
      dryRun: true,
      reclaimedBytes: items.reduce(
        (sum, item) => sum + (item.reclaimable ?? item.size),
        0,
      ),
      removedCount: items.length,
      items,
    };
  }

  private createExecResult(
    items: DockerCleanupCandidateItem[],
    output: string,
    fallbackBytes?: number,
  ): DockerCleanupResult {
    return {
      success: true,
      dryRun: false,
      reclaimedBytes: this.extractReclaimedBytes(output) ?? fallbackBytes ?? 0,
      removedCount: this.extractRemovedCount(output) || items.length,
      items,
    };
  }

  private extractRemovedCount(output: string): number {
    return output
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => {
        return (
          line.startsWith('Deleted') ||
          line.startsWith('Untagged:') ||
          line.startsWith('deleted:')
        );
      }).length;
  }

  private extractReclaimedBytes(output: string): number | null {
    const match =
      output.match(/Total reclaimed space:\s*([0-9.]+\s*[A-Za-z]+)/i) ??
      output.match(/Total:\s*([0-9.]+\s*[A-Za-z]+)/i);

    if (!match?.[1]) {
      return null;
    }

    return parseDockerSizeToBytes(match[1]);
  }

  private parseDetailedDfOutput(stdout: string): ParsedDfSections {
    const sections: ParsedDfSections = {
      images: [],
      containers: [],
      volumes: [],
      buildCache: [],
    };

    let currentSection: keyof ParsedDfSections | null = null;

    for (const rawLine of stdout.split('\n')) {
      const line = rawLine.trimEnd();
      const normalized = line.trim();

      if (!normalized) {
        continue;
      }

      if (normalized === 'Images space usage:') {
        currentSection = 'images';
        continue;
      }

      if (normalized === 'Containers space usage:') {
        currentSection = 'containers';
        continue;
      }

      if (normalized === 'Local Volumes space usage:') {
        currentSection = 'volumes';
        continue;
      }

      if (normalized.startsWith('Build cache usage:')) {
        currentSection = 'buildCache';
        continue;
      }

      if (
        normalized.startsWith('REPOSITORY') ||
        normalized.startsWith('CONTAINER ID') ||
        normalized.startsWith('VOLUME NAME') ||
        normalized.startsWith('CACHE ID')
      ) {
        continue;
      }

      if (!currentSection) {
        continue;
      }

      const columns = normalized.split(/\s{2,}/);

      if (currentSection === 'images' && columns.length >= 8) {
        sections.images.push({
          id: columns[2],
          label: `${columns[0]}:${columns[1]}`,
          detail: `${columns[6]} unique · ${columns[7]} containers`,
          size: parseDockerSizeToBytes(columns[4]),
          reclaimable:
            columns[7] === '0' ? parseDockerSizeToBytes(columns[4]) : 0,
        });
      }

      if (currentSection === 'containers' && columns.length >= 8) {
        sections.containers.push({
          id: columns[0],
          label: columns[7],
          detail: `${columns[1]} · ${columns[3]} volumes`,
          size: parseDockerSizeToBytes(columns[4]),
          state: columns[6],
        });
      }

      if (currentSection === 'volumes' && columns.length >= 3) {
        sections.volumes.push({
          id: columns[0],
          label: columns[0],
          detail: `${columns[1]} links`,
          size: parseDockerSizeToBytes(columns[2]),
          reclaimable:
            columns[1] === '0' ? parseDockerSizeToBytes(columns[2]) : 0,
        });
      }

      if (currentSection === 'buildCache' && columns.length >= 7) {
        sections.buildCache.push({
          id: columns[0],
          label: columns[0],
          detail: `${columns[1]} · ${columns[4]} · usage ${columns[5]}`,
          size: parseDockerSizeToBytes(columns[2]),
          reclaimable: parseDockerSizeToBytes(columns[2]),
        });
      }
    }

    return sections;
  }

  private async collectComposeOrphans(): Promise<DockerCleanupCandidateItem[]> {
    const composeServices = new Set(this.composeService.listServices());
    const containers = await this.dockerClient.listContainers(true);
    const candidates: DockerCleanupCandidateItem[] = [];

    for (const container of containers) {
      const inspected = await this.dockerClient.inspectContainer(container.id);
      const labels = inspected?.Config?.Labels ?? {};
      const composeService = labels['com.docker.compose.service'];
      const composeProject = labels['com.docker.compose.project'];

      if (!composeService || !composeProject) {
        continue;
      }

      if (composeProject !== 'kscold-control') {
        continue;
      }

      if (composeServices.has(composeService)) {
        continue;
      }

      candidates.push({
        id: container.id,
        label: container.name,
        detail: `${composeProject} · ${composeService}`,
        size: 0,
        state: container.state,
        readOnly: true,
      });
    }

    return candidates;
  }

  private async collectSafely<T>(
    label: string,
    collect: () => Promise<T>,
    fallback: T,
  ): Promise<{ value: T; warning?: string }> {
    try {
      return { value: await collect() };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : '알 수 없는 오류가 발생했습니다.';

      this.logger.warn(`${label} 수집에 실패했습니다: ${message}`);

      return {
        value: fallback,
        warning: `${label} 수집에 실패해서 일부 정보만 표시합니다.`,
      };
    }
  }
}
