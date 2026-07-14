import {
  Controller,
  NotFoundException,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Inject,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../../common/guards';
import { RequirePermissions } from '../../../common/decorators';
import { Audit } from '../../../common/decorators/audit.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions';
import { isGlobalAdministrator } from '../../../common/utils';
import type { JwtRequest } from '../../../common/types/jwt-request.type';
import {
  CreateContainerUseCase,
  ListContainersUseCase,
  StartContainerUseCase,
  StopContainerUseCase,
  RemoveContainerUseCase,
  ImportContainerUseCase,
  GetComposeProvisioningTemplateUseCase,
  CreateComposeServiceUseCase,
  RemoveComposeServiceUseCase,
  ListComposeServicesUseCase,
  GetTopologySnapshotUseCase,
  SaveTopologyLayoutUseCase,
  GetDockerCleanupCandidatesUseCase,
  PruneDanglingImagesUseCase,
  PruneBuildCacheUseCase,
  PruneExitedContainersUseCase,
  PruneDanglingVolumesUseCase,
} from '../../application/use-cases';
import { CreateContainerDto } from '../../application/dto';
import {
  IDockerClient,
  DOCKER_CLIENT,
} from '../../domain/repositories/docker-client.interface';

/**
 * Docker Controller
 * Handles HTTP requests for container management
 *
 * Clean Architecture: Controller only handles HTTP concerns,
 * all business logic is delegated to Use Cases.
 * Cross-cutting audit logging is handled via @Audit() + AuditInterceptor (AOP).
 */
@Controller('docker')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class DockerController {
  constructor(
    private readonly createContainerUseCase: CreateContainerUseCase,
    private readonly listContainersUseCase: ListContainersUseCase,
    private readonly startContainerUseCase: StartContainerUseCase,
    private readonly stopContainerUseCase: StopContainerUseCase,
    private readonly removeContainerUseCase: RemoveContainerUseCase,
    private readonly importContainerUseCase: ImportContainerUseCase,
    private readonly getComposeProvisioningTemplateUseCase: GetComposeProvisioningTemplateUseCase,
    private readonly createComposeServiceUseCase: CreateComposeServiceUseCase,
    private readonly removeComposeServiceUseCase: RemoveComposeServiceUseCase,
    private readonly listComposeServicesUseCase: ListComposeServicesUseCase,
    private readonly getTopologySnapshotUseCase: GetTopologySnapshotUseCase,
    private readonly saveTopologyLayoutUseCase: SaveTopologyLayoutUseCase,
    private readonly getDockerCleanupCandidatesUseCase: GetDockerCleanupCandidatesUseCase,
    private readonly pruneDanglingImagesUseCase: PruneDanglingImagesUseCase,
    private readonly pruneBuildCacheUseCase: PruneBuildCacheUseCase,
    private readonly pruneExitedContainersUseCase: PruneExitedContainersUseCase,
    private readonly pruneDanglingVolumesUseCase: PruneDanglingVolumesUseCase,
    @Inject(DOCKER_CLIENT) private readonly dockerClient: IDockerClient,
  ) {}

  /**
   * List all containers (no user filter - for topology)
   * GET /docker/containers/all
   */
  @Get('containers/all')
  @RequirePermissions(PERMISSIONS.DOCKER_READ)
  async listAllContainers() {
    return this.listContainersUseCase.execute(undefined);
  }

  /**
   * List containers (user-scoped)
   * GET /docker/containers
   */
  @Get('containers')
  @RequirePermissions(PERMISSIONS.DOCKER_READ)
  async listContainers(@Request() req: JwtRequest) {
    const userId = isGlobalAdministrator(req.user.roles)
      ? undefined
      : req.user.id;
    return this.listContainersUseCase.execute(userId);
  }

  /**
   * Get container internal processes (PM2 + services)
   * GET /docker/containers/:dockerId/processes
   */
  @Get('containers/:dockerId/processes')
  @RequirePermissions(PERMISSIONS.DOCKER_READ)
  async getContainerProcesses(
    @Param('dockerId') dockerId: string,
    @Request() req: JwtRequest,
  ) {
    const ownerId = getContainerOwnerScope(req);
    if (ownerId) {
      const ownedContainers = await this.listContainersUseCase.execute(ownerId);
      if (
        !ownedContainers.some((container) => container.dockerId === dockerId)
      ) {
        throw new NotFoundException('컨테이너를 찾을 수 없습니다.');
      }
    }

    return this.dockerClient.getContainerProcesses(dockerId);
  }

  @Get('topology/snapshot')
  @RequirePermissions(PERMISSIONS.DOCKER_READ)
  async getTopologySnapshot(@Request() req: JwtRequest) {
    return this.getTopologySnapshotUseCase.execute(req.user.id);
  }

  @Patch('topology/layout/nodes')
  @RequirePermissions(PERMISSIONS.DOCKER_UPDATE)
  @Audit({
    domain: 'docker',
    action: 'topology.layout.update',
    summary: '토폴로지 노드 배치를 저장했습니다.',
    targetType: 'topology',
    targetId: () => 'layout',
    metadata: (ctx) => ({
      nodeCount:
        (ctx.body as { positions?: unknown[] } | undefined)?.positions
          ?.length ?? 0,
    }),
  })
  async updateTopologyLayout(
    @Body()
    body: {
      positions?: Array<{
        nodeId?: string;
        x?: number;
        y?: number;
      }>;
    },
    @Request() req: JwtRequest,
  ) {
    await this.saveTopologyLayoutUseCase.execute(
      req.user.id,
      (body.positions ?? []).map((position) => ({
        nodeId: String(position.nodeId ?? ''),
        x: Number(position.x),
        y: Number(position.y),
      })),
    );

    return { success: true };
  }

  @Get('cleanup/candidates')
  @RequirePermissions(PERMISSIONS.DOCKER_READ)
  async getCleanupCandidates() {
    return this.getDockerCleanupCandidatesUseCase.execute();
  }

  @Post('cleanup/images/prune')
  @RequirePermissions(PERMISSIONS.DOCKER_DELETE)
  async pruneDanglingImages(@Body() body?: { dryRun?: boolean }) {
    return this.pruneDanglingImagesUseCase.execute(body?.dryRun ?? true);
  }

  @Post('cleanup/build-cache/prune')
  @RequirePermissions(PERMISSIONS.DOCKER_DELETE)
  async pruneBuildCache(@Body() body?: { dryRun?: boolean }) {
    return this.pruneBuildCacheUseCase.execute(body?.dryRun ?? true);
  }

  @Post('cleanup/containers/prune-exited')
  @RequirePermissions(PERMISSIONS.DOCKER_DELETE)
  async pruneExitedContainers(@Body() body?: { dryRun?: boolean }) {
    return this.pruneExitedContainersUseCase.execute(body?.dryRun ?? true);
  }

  @Post('cleanup/volumes/prune-dangling')
  @RequirePermissions(PERMISSIONS.DOCKER_DELETE)
  async pruneDanglingVolumes(@Body() body?: { dryRun?: boolean }) {
    return this.pruneDanglingVolumesUseCase.execute(body?.dryRun ?? true);
  }

  /**
   * Create a new container
   * POST /docker/containers
   */
  @Post('containers')
  @RequirePermissions(PERMISSIONS.DOCKER_CREATE)
  @Audit({
    domain: 'docker',
    action: 'container.create',
    summary: (ctx) =>
      `컨테이너 ${(ctx.body as { name: string }).name}을 생성했습니다.`,
    targetType: 'container',
    targetId: (ctx) => {
      const r = ctx.response as { id?: string };
      return r.id ?? (ctx.body as { name: string }).name;
    },
    metadata: (ctx) => {
      const b = ctx.body as { name: string; image: string; ports?: unknown };
      return { name: b.name, image: b.image, ports: b.ports };
    },
  })
  async createContainer(
    @Body() dto: CreateContainerDto,
    @Request() req: JwtRequest,
  ) {
    dto.userId = req.user.id;
    return this.createContainerUseCase.execute(dto);
  }

  /**
   * Import an external Docker container into management
   * POST /docker/containers/import
   */
  @Post('containers/import')
  @RequirePermissions(PERMISSIONS.DOCKER_CREATE)
  @Audit({
    domain: 'docker',
    action: 'container.import',
    summary: (ctx) =>
      `외부 Docker 컨테이너 ${(ctx.body as { dockerId: string }).dockerId}를 가져왔습니다.`,
    targetType: 'container',
    targetId: (ctx) => {
      const r = ctx.response as { id?: string };
      return r.id ?? (ctx.body as { dockerId: string }).dockerId;
    },
    metadata: (ctx) => {
      const r = ctx.response as { name?: string; image?: string };
      return {
        dockerId: (ctx.body as { dockerId: string }).dockerId,
        name: r.name,
        image: r.image,
      };
    },
  })
  async importContainer(
    @Body() body: { dockerId: string },
    @Request() req: JwtRequest,
  ) {
    return this.importContainerUseCase.execute(body.dockerId, req.user.id);
  }

  /**
   * Start a container
   * POST /docker/containers/:id/start
   */
  @Post('containers/:id/start')
  @RequirePermissions(PERMISSIONS.DOCKER_UPDATE)
  @Audit({
    domain: 'docker',
    action: 'container.start',
    summary: (ctx) => `컨테이너 ${ctx.params.id}를 시작했습니다.`,
    targetType: 'container',
    targetId: (ctx) => ctx.params.id,
  })
  async startContainer(@Param('id') id: string, @Request() req: JwtRequest) {
    await this.startContainerUseCase.execute(id, getContainerOwnerScope(req));
    return { success: true, message: 'Container started successfully' };
  }

  /**
   * Stop a container
   * POST /docker/containers/:id/stop
   */
  @Post('containers/:id/stop')
  @RequirePermissions(PERMISSIONS.DOCKER_UPDATE)
  @Audit({
    domain: 'docker',
    action: 'container.stop',
    summary: (ctx) => `컨테이너 ${ctx.params.id}를 중지했습니다.`,
    targetType: 'container',
    targetId: (ctx) => ctx.params.id,
  })
  async stopContainer(@Param('id') id: string, @Request() req: JwtRequest) {
    await this.stopContainerUseCase.execute(id, getContainerOwnerScope(req));
    return { success: true, message: 'Container stopped successfully' };
  }

  /**
   * Remove a container
   * DELETE /docker/containers/:id
   */
  @Delete('containers/:id')
  @RequirePermissions(PERMISSIONS.DOCKER_DELETE)
  @Audit({
    domain: 'docker',
    action: 'container.remove',
    summary: (ctx) => `컨테이너 ${ctx.params.id}를 제거했습니다.`,
    targetType: 'container',
    targetId: (ctx) => ctx.params.id,
  })
  async removeContainer(@Param('id') id: string, @Request() req: JwtRequest) {
    await this.removeContainerUseCase.execute(id, getContainerOwnerScope(req));
    return { success: true, message: 'Container removed successfully' };
  }

  // ===== Compose Endpoints =====

  /**
   * List compose services
   * GET /docker/compose/services
   */
  @Get('compose/services')
  @RequirePermissions(PERMISSIONS.DOCKER_READ)
  async listComposeServices() {
    return this.listComposeServicesUseCase.execute();
  }

  @Get('compose/provisioning-template')
  @RequirePermissions(PERMISSIONS.DOCKER_READ)
  async getComposeProvisioningTemplate() {
    return this.getComposeProvisioningTemplateUseCase.execute();
  }

  /**
   * Add a new instance to docker-compose.yml and start it
   * POST /docker/compose/services
   */
  @Post('compose/services')
  @RequirePermissions(PERMISSIONS.DOCKER_CREATE)
  @Audit({
    domain: 'docker',
    action: 'compose.create-service',
    summary: (ctx) =>
      `Compose 서비스 ${(ctx.body as { name: string }).name}을 생성했습니다.`,
    targetType: 'compose-service',
    targetId: (ctx) => (ctx.body as { name: string }).name,
    metadata: (ctx) => {
      const b = ctx.body as { image: string; ports?: unknown };
      return { image: b.image, ports: b.ports };
    },
  })
  async addComposeService(
    @Body()
    body: {
      name: string;
      image: string;
      ports: Record<string, number>;
      cpus: string;
      memLimit: string;
      command?: string;
    },
    @Request() req: JwtRequest,
  ) {
    const result = await this.createComposeServiceUseCase.execute(
      body,
      req.user.id,
    );
    return {
      success: true,
      message: `Service "${body.name}" created`,
      ...result,
    };
  }

  /**
   * Remove a compose service
   * DELETE /docker/compose/services/:name
   */
  @Delete('compose/services/:name')
  @RequirePermissions(PERMISSIONS.DOCKER_DELETE)
  @Audit({
    domain: 'docker',
    action: 'compose.remove-service',
    summary: (ctx) => `Compose 서비스 ${ctx.params.name}을 제거했습니다.`,
    targetType: 'compose-service',
    targetId: (ctx) => ctx.params.name,
  })
  async removeComposeService(@Param('name') name: string) {
    await this.removeComposeServiceUseCase.execute(name);
    return { success: true, message: `Service "${name}" removed from compose` };
  }
}

function getContainerOwnerScope(req: JwtRequest): string | undefined {
  return isGlobalAdministrator(req.user.roles) ? undefined : req.user.id;
}
