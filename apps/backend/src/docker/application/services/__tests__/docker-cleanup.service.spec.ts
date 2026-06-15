import { Test, TestingModule } from '@nestjs/testing';
import { DockerCleanupService } from '../docker-cleanup.service';
import { ComposeService } from '../compose.service';
import { DockerCommandService } from '../docker-command.service';
import {
  DOCKER_CLIENT,
  type IDockerClient,
} from '../../../domain/repositories/docker-client.interface';

describe('DockerCleanupService', () => {
  let service: DockerCleanupService;
  let dockerCommandService: jest.Mocked<DockerCommandService>;

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
          provide: DockerCommandService,
          useValue: {
            run: jest.fn(),
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
    dockerCommandService = module.get(DockerCommandService);

    dockerCommandService.run.mockImplementation(async (command: string) => {
      if (command.includes('docker system df --format')) {
        return [
          '{"Active":"1","Reclaimable":"1.5GB (100%)","Size":"1.5GB","TotalCount":"1","Type":"Images"}',
          '{"Active":"1","Reclaimable":"120MB (100%)","Size":"120MB","TotalCount":"1","Type":"Containers"}',
          '{"Active":"0","Reclaimable":"256MB (100%)","Size":"256MB","TotalCount":"1","Type":"Local Volumes"}',
          '{"Active":"0","Reclaimable":"512MB","Size":"512MB","TotalCount":"2","Type":"Build Cache"}',
        ].join('\n');
      }

      if (command.includes('docker system df -v')) {
        return [
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
        ].join('\n');
      }

      if (command.includes('docker image prune -f')) {
        return 'Deleted Images:\nuntagged: <none>:<none>\nTotal reclaimed space: 1.5GB';
      }

      if (command.includes('docker builder prune -f')) {
        return 'Deleted build cache objects:\nabc123\nTotal: 512MB';
      }

      return '';
    });

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

    (
      jest.spyOn(
        service as never,
        'collectArtifactFiles' as never,
      ) as unknown as jest.Mock
    ).mockResolvedValue([
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
    dockerCommandService.run.mockImplementation(async (command: string) => {
      if (command.includes('docker system df --format')) {
        return [
          '{"Active":"1","Reclaimable":"1.5GB (100%)","Size":"1.5GB","TotalCount":"1","Type":"Images"}',
          '{"Active":"1","Reclaimable":"120MB (100%)","Size":"120MB","TotalCount":"1","Type":"Containers"}',
          '{"Active":"0","Reclaimable":"256MB (100%)","Size":"256MB","TotalCount":"1","Type":"Local Volumes"}',
          '{"Active":"0","Reclaimable":"512MB","Size":"512MB","TotalCount":"2","Type":"Build Cache"}',
        ].join('\n');
      }

      if (command.includes('docker system df -v')) {
        throw new Error('docker df detail unavailable');
      }

      return '';
    });

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
