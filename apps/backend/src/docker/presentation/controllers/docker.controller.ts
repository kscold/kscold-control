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
} from '../../application/use-cases';
import { CreateContainerDto } from '../../application/dto';

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
}
