import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PERMISSIONS } from '../../../common/constants/permissions';
import { Audit, RequirePermissions } from '../../../common/decorators';
import { PermissionsGuard } from '../../../common/guards';
import { GetStorageOverviewDto } from '../../application/dto';
import {
  GetStorageOverviewUseCase,
  TrimDockerDiskUseCase,
} from '../../application/use-cases';
import type { DockerDiskTrimResult } from '../../domain/types/storage.type';

function formatGiB(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(1)} GiB`;
}

/**
 * 저장공간 컨트롤러
 * 현황 조회는 시스템 조회 권한, 공간 반환은 시스템 변경 권한이 필요하다.
 */
@Controller('maintenance/storage')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class StorageController {
  constructor(
    private readonly getOverview: GetStorageOverviewUseCase,
    private readonly trimDockerDisk: TrimDockerDiskUseCase,
  ) {}

  /** 처음 잴 때는 폴더 크기 때문에 수십 초 걸릴 수 있고, 10분 동안 결과를 다시 쓴다 */
  @Get()
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  async overview(@Query() query: GetStorageOverviewDto) {
    const overview = await this.getOverview.execute({
      refresh: query.refresh === true,
    });
    return { ...overview, measuredAt: overview.measuredAt.toISOString() };
  }

  /** VM 안에서 지운 공간을 맥에 돌려준다. 서비스를 멈추지 않는다 */
  @Post('docker-disk/trim')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.SYSTEM_WRITE)
  @Audit({
    domain: 'maintenance',
    action: 'storage.docker-disk.trim',
    summary: (ctx) => {
      const result = ctx.response as DockerDiskTrimResult;
      const returned = Math.max(
        0,
        result.allocatedBeforeBytes - result.allocatedAfterBytes,
      );
      return `도커 VM 디스크에서 지운 공간 ${formatGiB(returned)}를 맥에 돌려줬습니다.`;
    },
    targetType: 'docker-vm-disk',
    targetId: () => 'docker-vm',
    metadata: (ctx) => {
      const result = ctx.response as DockerDiskTrimResult;
      return {
        allocatedBeforeBytes: result.allocatedBeforeBytes,
        allocatedAfterBytes: result.allocatedAfterBytes,
        trimmedBytes: result.trimmedBytes,
      };
    },
  })
  async trim(): Promise<DockerDiskTrimResult> {
    return this.trimDockerDisk.execute();
  }
}
