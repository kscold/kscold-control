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
import { PermissionsGuard } from '../common/guards';
import { RequirePermissions } from '../common/decorators';
import {
  IsString,
  IsNumber,
  IsObject,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class ResourcesDto {
  @IsNumber()
  cpus: number;

  @IsString()
  memory: string;
}

class CreateContainerBody {
  @IsString()
  name: string;

  @IsString()
  image: string;

  @IsObject()
  ports: Record<string, number>;

  @ValidateNested()
  @Type(() => ResourcesDto)
  resources: { cpus: number; memory: string };

  @IsOptional()
  @IsObject()
  environment?: Record<string, string>;
}

@Controller('docker')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class DockerController {
  constructor(private dockerService: DockerService) {}

  @Get('containers')
  @RequirePermissions('docker:read')
  async listContainers(@Request() req: any) {
    return this.dockerService.listContainers(req.user.id);
  }

  @Get('containers/all')
  @RequirePermissions('docker:read')
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
  @RequirePermissions('docker:update')
  async startContainer(@Param('id') id: string) {
    return this.dockerService.startContainer(id);
  }

  @Post('containers/:id/stop')
  @RequirePermissions('docker:update')
  async stopContainer(@Param('id') id: string) {
    return this.dockerService.stopContainer(id);
  }

  @Delete('containers/:id')
  @RequirePermissions('docker:delete')
  async removeContainer(@Param('id') id: string) {
    return this.dockerService.removeContainer(id);
  }

  @Get('containers/:id/stats')
  @RequirePermissions('docker:read')
  async getStats(@Param('id') id: string) {
    return this.dockerService.getStats(id);
  }
}
