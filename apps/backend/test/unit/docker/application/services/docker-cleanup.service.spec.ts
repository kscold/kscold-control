import { Test, TestingModule } from '@nestjs/testing';
import { DockerCleanupService } from '@/docker/application/services/docker-cleanup.service';
import { ComposeService } from '@/docker/application/services/compose.service';
import {
  DOCKER_CLIENT,
  type IDockerClient,
} from '@/docker/domain/gateways/docker-client.gateway.interface';
import {
  DOCKER_CLEANUP_GATEWAY,
  type IDockerCleanupGateway,
} from '@/docker/domain/gateways/docker-cleanup.gateway.interface';
import {
  DOCKER_ARTIFACT_GATEWAY,
  type IDockerArtifactGateway,
} from '@/docker/domain/gateways/docker-artifact.gateway.interface';

describe('DockerCleanupService', () => {
  let service: DockerCleanupService;
  let dockerCleanupGateway: jest.Mocked<IDockerCleanupGateway>;
  let dockerArtifactGateway: jest.Mocked<IDockerArtifactGateway>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DockerCleanupService,
        {
          provide: ComposeService,
          useValue: {
            listServices: jest.fn().mockReturnValue(['nginx', 'ubuntu-blog']),
          },
        },
        {
          provide: DOCKER_CLEANUP_GATEWAY,
          useValue: {
            getUsageSummary: jest.fn(),
            getDetailedUsage: jest.fn(),
            pruneDanglingImages: jest.fn(),
            pruneExitedContainers: jest.fn(),
            pruneDanglingVolumes: jest.fn(),
            pruneBuildCache: jest.fn(),
          },
        },
        {
          provide: DOCKER_ARTIFACT_GATEWAY,
          useValue: {
            listArtifacts: jest.fn(),
          },
        },
        {
          provide: DOCKER_CLIENT,
          useValue: {
            listContainers: jest.fn(),
            inspectContainer: jest.fn(),
          } satisfies Partial<IDockerClient>,
        },
      ],
    }).compile();

    service = module.get(DockerCleanupService);
    dockerCleanupGateway = module.get(DOCKER_CLEANUP_GATEWAY);
    dockerArtifactGateway = module.get(DOCKER_ARTIFACT_GATEWAY);

    dockerCleanupGateway.getUsageSummary.mockResolvedValue(
      [
        '{"Active":"1","Reclaimable":"1.5GB (100%)","Size":"1.5GB","TotalCount":"1","Type":"Images"}',
        '{"Active":"1","Reclaimable":"120MB (100%)","Size":"120MB","TotalCount":"1","Type":"Containers"}',
        '{"Active":"0","Reclaimable":"256MB (100%)","Size":"256MB","TotalCount":"1","Type":"Local Volumes"}',
        '{"Active":"0","Reclaimable":"512MB","Size":"512MB","TotalCount":"2","Type":"Build Cache"}',
      ].join('\n'),
    );
    dockerCleanupGateway.getDetailedUsage.mockResolvedValue(
      [
        'Images space usage:',
        'REPOSITORY          TAG                 IMAGE ID            CREATED             SIZE                SHARED SIZE         UNIQUE SIZE         CONTAINERS',
        '<none>              <none>              imgdangling         2 days ago          1.5GB               0B                  1.5GB               0',
        '',
        'Containers space usage:',
        'CONTAINER ID        IMAGE               COMMAND             LOCAL VOLUMES       SIZE                CREATED             STATUS              NAMES',
        'cont-exited         ubuntu-blog         "node"              1                   120MB               2 days ago          Exited (0) 2 days ago  old-blog',
        '',
        'Local Volumes space usage:',
        'VOLUME NAME         LINKS               SIZE',
        'dangling-volume     0                   256MB',
        '',
        'Build cache usage: 512MB',
        'CACHE ID            CACHE TYPE          SIZE                CREATED             LAST USED           USAGE               SHARED',
        'cache-1             regular             512MB               2 days ago          5m ago             1                   false',
      ].join('\n'),
    );
    dockerCleanupGateway.pruneDanglingImages.mockResolvedValue(
      'Deleted Images:\nuntagged: <none>:<none>\nTotal reclaimed space: 1.5GB',
    );
    dockerCleanupGateway.pruneBuildCache.mockResolvedValue(
      'Deleted build cache objects:\nabc123\nTotal: 512MB',
    );

    (
      jest.spyOn(
        service as never,
        'collectComposeOrphans' as never,
      ) as unknown as jest.Mock
    ).mockResolvedValue([
      {
        id: 'orphan-1',
        label: 'old-nginx',
        detail: 'kscold-control · old-nginx',
        size: 0,
        readOnly: true,
      },
    ]);

    dockerArtifactGateway.listArtifacts.mockResolvedValue([
      {
        id: 'apps/frontend/dist',
        label: 'apps/frontend/dist',
        detail: '배포 부산물',
        size: 1024,
        readOnly: true,
      },
    ]);
  });

  it('정리 후보를 카테고리별로 분리한다', async () => {
    const result = await service.getCandidates();

    expect(result.images.items).toHaveLength(1);
    expect(result.images.items[0].label).toBe('<none>:<none>');
    expect(result.containers.items[0].label).toBe('old-blog');
    expect(result.volumes.items[0].label).toBe('dangling-volume');
    expect(result.buildCache.items[0].label).toBe('cache-1');
    expect(result.composeOrphans.items[0].label).toBe('old-nginx');
    expect(result.artifactFiles.items[0].label).toBe('apps/frontend/dist');
    expect(result.summary.warningCount).toBe(0);
    expect(result.warnings).toEqual([]);
  });

  it('일부 수집에 실패해도 빈 카테고리와 경고를 반환한다', async () => {
    dockerCleanupGateway.getDetailedUsage.mockRejectedValue(
      new Error('docker df detail unavailable'),
    );

    const result = await service.getCandidates();

    expect(result.images.items).toEqual([]);
    expect(result.summary.warningCount).toBe(1);
    expect(result.warnings[0]).toContain('Docker 상세 사용량');
    expect(result.composeOrphans.items[0].label).toBe('old-nginx');
  });

  it('dryRun으로 dangling 이미지 예상치를 반환한다', async () => {
    const result = await service.pruneDanglingImages(true);

    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.removedCount).toBe(1);
    expect(result.reclaimedBytes).toBeGreaterThan(0);
  });

  it('빌드 캐시 정리를 실행하면 실행 결과를 반환한다', async () => {
    const result = await service.pruneBuildCache(false);

    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(false);
    expect(result.removedCount).toBeGreaterThan(0);
    expect(result.reclaimedBytes).toBeGreaterThan(0);
  });
});
