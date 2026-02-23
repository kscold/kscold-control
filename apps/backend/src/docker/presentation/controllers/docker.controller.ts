import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../../common/guards';
import { RequirePermissions } from '../../../common/decorators';
import {
  CreateContainerUseCase,
  ListContainersUseCase,
  StartContainerUseCase,
  StopContainerUseCase,
  RemoveContainerUseCase,
  ImportContainerUseCase,
} from '../../application/use-cases';
import { CreateContainerDto } from '../../application/dto';
import { ComposeService } from '../../application/services/compose.service';

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
    private readonly composeService: ComposeService,
  ) {}

  /**
   * List all containers
   * GET /docker/containers
   */
  @Get('containers')
  @RequirePermissions('docker:read')
  async listContainers(@Request() req: any) {
    const userId = req.user.roles?.includes('super_admin')
      ? undefined
      : req.user.sub;
    return this.listContainersUseCase.execute(userId);
  }

  /**
   * Create a new container
   * POST /docker/containers
   */
  @Post('containers')
  @RequirePermissions('docker:create')
  async createContainer(@Body() dto: CreateContainerDto, @Request() req: any) {
    dto.userId = req.user.sub;
    return this.createContainerUseCase.execute(dto);
  }

  /**
   * Import an external Docker container into management
   * POST /docker/containers/import
   */
  @Post('containers/import')
  @RequirePermissions('docker:create')
  async importContainer(
    @Body() body: { dockerId: string },
    @Request() req: any,
  ) {
    return this.importContainerUseCase.execute(body.dockerId, req.user.sub);
  }

  /**
   * Start a container
   * POST /docker/containers/:id/start
   */
  @Post('containers/:id/start')
  @RequirePermissions('docker:update')
  async startContainer(@Param('id') id: string) {
    await this.startContainerUseCase.execute(id);
    return { success: true, message: 'Container started successfully' };
  }

  /**
   * Stop a container
   * POST /docker/containers/:id/stop
   */
  @Post('containers/:id/stop')
  @RequirePermissions('docker:update')
  async stopContainer(@Param('id') id: string) {
    await this.stopContainerUseCase.execute(id);
    return { success: true, message: 'Container stopped successfully' };
  }

  /**
   * Remove a container
   * DELETE /docker/containers/:id
   */
  @Delete('containers/:id')
  @RequirePermissions('docker:delete')
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
  @RequirePermissions('docker:read')
  async listComposeServices() {
    return {
      services: this.composeService.listServices(),
      compose: this.composeService.readCompose(),
    };
  }

  /**
   * Add a new instance to docker-compose.yml and start it
   * POST /docker/compose/services
   */
  @Post('compose/services')
  @RequirePermissions('docker:create')
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
    @Request() req: any,
  ) {
    // 1. Add to docker-compose.yml
    this.composeService.addService(body);

    // 2. docker compose up -d for the new service
    const output = await this.composeService.upService(body.name);

    // 3. Wait for container to be created, then import into DB
    await new Promise((resolve) => setTimeout(resolve, 2000));

    try {
      const dockerContainers =
        await this.listContainersUseCase.execute(undefined);
      const newContainer = dockerContainers.find(
        (c) => c.name === body.name || c.name === `/${body.name}`,
      );

      if (newContainer && !newContainer.isManaged) {
        await this.importContainerUseCase.execute(
          newContainer.dockerId,
          req.user.sub,
        );
      }
    } catch (err) {
      // Auto-import failed, but service is running
    }

    return { success: true, message: `Service "${body.name}" created`, output };
  }

  /**
   * Remove a compose service
   * DELETE /docker/compose/services/:name
   */
  @Delete('compose/services/:name')
  @RequirePermissions('docker:delete')
  async removeComposeService(@Param('name') name: string) {
    // 1. Stop and remove the container
    await this.composeService.downService(name);

    // 2. Remove from docker-compose.yml
    this.composeService.removeService(name);

    // 3. Clean up DB entry if exists
    try {
      const containers = await this.listContainersUseCase.execute(undefined);
      const container = containers.find((c) => c.name === name && c.isManaged);
      if (container) {
        await this.removeContainerUseCase.execute(container.id);
      }
    } catch {
      // DB cleanup failed, but compose service is removed
    }

    return {
      success: true,
      message: `Service "${name}" removed from compose`,
    };
  }
}
