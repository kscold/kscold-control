import {
  Controller,
  Get,
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
import { PERMISSIONS } from '../../../common/constants/permissions';
import { ROLES } from '../../../common/constants/roles';
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
} from '../../application/use-cases';
import { CreateContainerDto } from '../../application/dto';
import { ComposeService } from '../../application/services/compose.service';
import { DockerTopologyService } from '../../application/services/docker-topology.service';
import { DockerCleanupService } from '../../application/services/docker-cleanup.service';
import { AuditLogService } from '../../../audit/application/services/audit-log.service';
import {
  IDockerClient,
  DOCKER_CLIENT,
} from '../../domain/repositories/docker-client.interface';

/**
 * Docker Controller
 * Handles HTTP requests for container management
 *
 * Clean Architecture: Controller only handles HTTP concerns,
 * all business logic is delegated to Use Cases
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
    private readonly composeService: ComposeService,
    private readonly dockerTopologyService: DockerTopologyService,
    private readonly dockerCleanupService: DockerCleanupService,
    private readonly auditLogService: AuditLogService,
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
    const userId = req.user.roles?.includes(ROLES.SUPER_ADMIN)
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
  async getContainerProcesses(@Param('dockerId') dockerId: string) {
    return this.dockerClient.getContainerProcesses(dockerId);
  }

  @Get('topology/snapshot')
  @RequirePermissions(PERMISSIONS.DOCKER_READ)
  async getTopologySnapshot() {
    return this.dockerTopologyService.getSnapshot();
  }

  @Get('cleanup/candidates')
  @RequirePermissions(PERMISSIONS.DOCKER_READ)
  async getCleanupCandidates() {
    return this.dockerCleanupService.getCandidates();
  }

  @Post('cleanup/images/prune')
  @RequirePermissions(PERMISSIONS.DOCKER_DELETE)
  async pruneDanglingImages(@Body() body?: { dryRun?: boolean }) {
    return this.dockerCleanupService.pruneDanglingImages(body?.dryRun ?? true);
  }

  @Post('cleanup/build-cache/prune')
  @RequirePermissions(PERMISSIONS.DOCKER_DELETE)
  async pruneBuildCache(@Body() body?: { dryRun?: boolean }) {
    return this.dockerCleanupService.pruneBuildCache(body?.dryRun ?? true);
  }

  @Post('cleanup/containers/prune-exited')
  @RequirePermissions(PERMISSIONS.DOCKER_DELETE)
  async pruneExitedContainers(@Body() body?: { dryRun?: boolean }) {
    return this.dockerCleanupService.pruneExitedContainers(body?.dryRun ?? true);
  }

  @Post('cleanup/volumes/prune-dangling')
  @RequirePermissions(PERMISSIONS.DOCKER_DELETE)
  async pruneDanglingVolumes(@Body() body?: { dryRun?: boolean }) {
    return this.dockerCleanupService.pruneDanglingVolumes(body?.dryRun ?? true);
  }

  /**
   * Create a new container
   * POST /docker/containers
   */
  @Post('containers')
  @RequirePermissions(PERMISSIONS.DOCKER_CREATE)
  async createContainer(@Body() dto: CreateContainerDto, @Request() req: JwtRequest) {
    dto.userId = req.user.id;
    return this.createContainerUseCase.execute(dto);
  }

  /**
   * Import an external Docker container into management
   * POST /docker/containers/import
   */
  @Post('containers/import')
  @RequirePermissions(PERMISSIONS.DOCKER_CREATE)
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
  async startContainer(@Param('id') id: string, @Request() req: JwtRequest) {
    await this.startContainerUseCase.execute(id);
    await this.auditLogService.record({
      domain: 'docker',
      action: 'container.start',
      summary: `컨테이너 ${id}를 시작했습니다.`,
      actorId: req.user?.id ?? req.user?.sub ?? null,
      actorEmail: req.user?.email ?? null,
      targetType: 'container',
      targetId: id,
    });
    return { success: true, message: 'Container started successfully' };
  }

  /**
   * Stop a container
   * POST /docker/containers/:id/stop
   */
  @Post('containers/:id/stop')
  @RequirePermissions(PERMISSIONS.DOCKER_UPDATE)
  async stopContainer(@Param('id') id: string, @Request() req: JwtRequest) {
    await this.stopContainerUseCase.execute(id);
    await this.auditLogService.record({
      domain: 'docker',
      action: 'container.stop',
      summary: `컨테이너 ${id}를 중지했습니다.`,
      actorId: req.user?.id ?? req.user?.sub ?? null,
      actorEmail: req.user?.email ?? null,
      targetType: 'container',
      targetId: id,
    });
    return { success: true, message: 'Container stopped successfully' };
  }

  /**
   * Remove a container
   * DELETE /docker/containers/:id
   */
  @Delete('containers/:id')
  @RequirePermissions(PERMISSIONS.DOCKER_DELETE)
  async removeContainer(@Param('id') id: string) {
    await this.removeContainerUseCase.execute(id);
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
    return {
      services: this.composeService.listServices(),
      compose: this.composeService.readCompose(),
    };
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
  async removeComposeService(@Param('name') name: string) {
    await this.removeComposeServiceUseCase.execute(name);

    return { success: true, message: `Service "${name}" removed from compose` };
  }
}
