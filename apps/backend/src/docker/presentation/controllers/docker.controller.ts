import {
  Controller,
  Get,
  Patch,
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
import { Audit } from '../../../common/decorators/audit.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions';
import { isGlobalAdministrator } from '../../../common/utils';
import type { JwtRequest } from '../../../common/types/jwt-request.type';
import {
  CreateContainerUseCase,
  ListContainersUseCase,
  GetContainerProcessesUseCase,
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
  CreateComposeServiceRequestDto,
  CreateContainerRequestDto,
  DockerCleanupRequestDto,
  ImportContainerRequestDto,
  UpdateTopologyLayoutRequestDto,
} from '../dto';

/**
 * Docker 컨테이너 관리 HTTP 요청 처리함.
 *
 * 컨트롤러는 인증된 요청에서 사용자 범위와 HTTP 입출력만 다루고,
 * 생성·삭제·Compose·정리 같은 업무 규칙은 각 애플리케이션 유스케이스로 위임함.
 * 감사 기록은 @Audit 데코레이터와 인터셉터가 공통으로 처리함.
 */
@Controller('docker')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class DockerController {
  constructor(
    private readonly createContainerUseCase: CreateContainerUseCase,
    private readonly listContainersUseCase: ListContainersUseCase,
    private readonly getContainerProcessesUseCase: GetContainerProcessesUseCase,
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
  ) {}

  /**
   * 토폴로지용 전체 컨테이너 조회함.
   *
   * 이 엔드포인트는 전역 권한을 가진 화면에서만 사용하며, 일반 목록 조회와 달리
   * 사용자 ID를 전달하지 않아 관리 대상과 외부 컨테이너를 모두 포함함.
   */
  @Get('containers/all')
  @RequirePermissions(PERMISSIONS.DOCKER_READ)
  async listAllContainers() {
    return this.listContainersUseCase.execute(undefined);
  }

  /** 대시보드에는 컨테이너 식별 정보 없이 전체 개수만 공개함. */
  @Get('dashboard/container-summary')
  @RequirePermissions(PERMISSIONS.DASHBOARD_READ)
  async getDashboardContainerSummary() {
    const containers = await this.listContainersUseCase.execute(undefined);
    return {
      total: containers.length,
      running: containers.filter(
        (container) => container.liveStatus === 'running',
      ).length,
    };
  }

  /**
   * 로그인 사용자의 컨테이너 목록 조회함.
   *
   * 전역 관리자는 모든 컨테이너를, 그 외 사용자는 자신이 관리하는 컨테이너만
   * 유스케이스에 전달해 결과 범위를 일관되게 제한함.
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
   * 컨테이너 내부 PM2와 시스템 서비스 조회함.
   *
   * 표현 계층은 Docker 게이트웨이에 직접 접근하지 않고, 사용자 소유 범위를
   * 유스케이스에 전달함. 따라서 HTTP 외 호출도 같은 권한 검증 재사용함.
   */
  @Get('containers/:dockerId/processes')
  @RequirePermissions(PERMISSIONS.DOCKER_READ)
  async getContainerProcesses(
    @Param('dockerId') dockerId: string,
    @Request() req: JwtRequest,
  ) {
    return this.getContainerProcessesUseCase.execute(
      dockerId,
      getContainerOwnerScope(req),
    );
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
    body: UpdateTopologyLayoutRequestDto,
    @Request() req: JwtRequest,
  ) {
    await this.saveTopologyLayoutUseCase.execute(
      req.user.id,
      body.positions.map((position) => ({
        nodeId: position.nodeId,
        x: position.x,
        y: position.y,
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
  async pruneDanglingImages(@Body() body?: DockerCleanupRequestDto) {
    return this.pruneDanglingImagesUseCase.execute(body?.dryRun ?? true);
  }

  @Post('cleanup/build-cache/prune')
  @RequirePermissions(PERMISSIONS.DOCKER_DELETE)
  async pruneBuildCache(@Body() body?: DockerCleanupRequestDto) {
    return this.pruneBuildCacheUseCase.execute(body?.dryRun ?? true);
  }

  @Post('cleanup/containers/prune-exited')
  @RequirePermissions(PERMISSIONS.DOCKER_DELETE)
  async pruneExitedContainers(@Body() body?: DockerCleanupRequestDto) {
    return this.pruneExitedContainersUseCase.execute(body?.dryRun ?? true);
  }

  @Post('cleanup/volumes/prune-dangling')
  @RequirePermissions(PERMISSIONS.DOCKER_DELETE)
  async pruneDanglingVolumes(@Body() body?: DockerCleanupRequestDto) {
    return this.pruneDanglingVolumesUseCase.execute(body?.dryRun ?? true);
  }

  /**
   * 새 컨테이너 생성함.
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
    @Body() dto: CreateContainerRequestDto,
    @Request() req: JwtRequest,
  ) {
    return this.createContainerUseCase.execute(
      CreateContainerDto.from({
        ...dto,
        userId: req.user.id,
      }),
    );
  }

  /**
   * 외부 Docker 컨테이너를 현재 사용자의 관리 대상으로 가져옴.
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
    @Body() body: ImportContainerRequestDto,
    @Request() req: JwtRequest,
  ) {
    return this.importContainerUseCase.execute(body.dockerId, req.user.id);
  }

  /**
   * 컨테이너 시작함.
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
   * 컨테이너 중지함.
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
   * 컨테이너 제거함.
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

  // ===== Compose 서비스 엔드포인트 =====

  /**
   * Compose 서비스 목록 조회함.
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
   * docker-compose.yml에 새 인스턴스를 추가하고 시작함.
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
    body: CreateComposeServiceRequestDto,
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
   * Compose 서비스 제거함.
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
