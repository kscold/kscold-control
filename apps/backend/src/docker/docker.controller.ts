import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DockerService, CreateContainerDto } from './docker.service';
import {
  RequirePermissions,
  PermissionsGuard,
} from '../auth/permissions.guard';

class CreateContainerBody {
  name: string;
  image: string;
  ports: Record<string, number>;
  resources: { cpus: number; memory: string };
  environment?: Record<string, string>;
}

@Controller('docker')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class DockerController {
  constructor(private dockerService: DockerService) {}

  @Get('containers')
  async listContainers(@Request() req: any) {
    return this.dockerService.listContainers(req.user.id);
  }

  @Get('containers/all')
  @RequirePermissions('docker:read-all')
  async listAllContainers() {
    return this.dockerService.listContainers();
  }

  @Post('containers')
  @RequirePermissions('docker:create')
  async createContainer(
    @Request() req: any,
    @Body() body: CreateContainerBody,
  ) {
    const dto: CreateContainerDto = {
      ...body,
      userId: req.user.id,
    };
    return this.dockerService.createContainer(dto);
  }

  @Post('containers/:id/start')
  @RequirePermissions('docker:start')
  async startContainer(@Param('id') id: string) {
    return this.dockerService.startContainer(id);
  }

  @Post('containers/:id/stop')
  @RequirePermissions('docker:stop')
  async stopContainer(@Param('id') id: string) {
    return this.dockerService.stopContainer(id);
  }

  @Delete('containers/:id')
  @RequirePermissions('docker:delete')
  async removeContainer(@Param('id') id: string) {
    return this.dockerService.removeContainer(id);
  }

  @Get('containers/:id/stats')
  async getStats(@Param('id') id: string) {
    return this.dockerService.getStats(id);
  }
}
