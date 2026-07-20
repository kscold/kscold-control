import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { Audit } from '../../../common/decorators/audit.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions';
import {
  ListNginxSitesUseCase,
  CreateNginxSiteUseCase,
  UpdateNginxSiteUseCase,
  DeleteNginxSiteUseCase,
  ToggleNginxSiteUseCase,
  TestNginxConfigUseCase,
  ReloadNginxUseCase,
  GetNginxUpstreamsUseCase,
  ListCertsUseCase,
  IssueCertUseCase,
  RenewCertsUseCase,
  GetCertRenewalStatusUseCase,
  GetPublicIpUseCase,
  VerifyDnsUseCase,
  VerifyAllDnsUseCase,
} from '../../application/use-cases';
import { CreateNginxSiteDto } from '../../application/dto';
import { CreateNginxSiteRequestDto } from '../dto';
import type { JwtRequest } from '../../../common/types/jwt-request.type';

/** 감사 로그용 사이트 스냅샷 — 모듈 레벨 순수 함수로 분리 (데코레이터 팩토리에서 공유) */
function toSiteSnapshot(
  site:
    | {
        name: string;
        domain: string;
        upstream: string;
        ssl: boolean;
        websocket: boolean;
        enabled: boolean;
      }
    | null
    | undefined,
) {
  if (!site) {
    return null;
  }

  return {
    name: site.name,
    domain: site.domain,
    upstream: site.upstream,
    ssl: site.ssl,
    websocket: site.websocket,
    enabled: site.enabled,
  };
}

/** req 에 주입하는 감사용 추가 데이터 타입 (변경 전 스냅샷·정규화된 명령) */
interface NginxRequest extends JwtRequest {
  _auditExtra?: {
    before?: ReturnType<typeof toSiteSnapshot>;
    command?: CreateNginxSiteDto;
  };
}

/**
 * Nginx 컨트롤러
 * 표현 계층 — HTTP 관심사만 처리합니다.
 * 횡단 관심사인 감사 로깅은 @Audit() + AuditInterceptor(AOP)가 담당합니다.
 *
 * 변경 전 스냅샷이 필요한 핸들러에서는 req._auditExtra = { before } 를 설정합니다.
 * AuditInterceptor 가 이를 ctx.extra 로 전달하므로 metadata 팩토리에서 접근 가능합니다.
 */
@Controller('nginx')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class NginxController {
  constructor(
    private readonly listSitesUseCase: ListNginxSitesUseCase,
    private readonly createSiteUseCase: CreateNginxSiteUseCase,
    private readonly updateSiteUseCase: UpdateNginxSiteUseCase,
    private readonly deleteSiteUseCase: DeleteNginxSiteUseCase,
    private readonly toggleSiteUseCase: ToggleNginxSiteUseCase,
    private readonly testConfigUseCase: TestNginxConfigUseCase,
    private readonly reloadNginxUseCase: ReloadNginxUseCase,
    private readonly getUpstreamsUseCase: GetNginxUpstreamsUseCase,
    private readonly listCertsUseCase: ListCertsUseCase,
    private readonly issueCertUseCase: IssueCertUseCase,
    private readonly renewCertsUseCase: RenewCertsUseCase,
    private readonly getRenewalStatusUseCase: GetCertRenewalStatusUseCase,
    private readonly getPublicIpUseCase: GetPublicIpUseCase,
    private readonly verifyDnsUseCase: VerifyDnsUseCase,
    private readonly verifyAllDnsUseCase: VerifyAllDnsUseCase,
  ) {}

  @Get('sites')
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  listSites() {
    return this.listSitesUseCase.execute();
  }

  @Post('sites')
  @RequirePermissions(PERMISSIONS.SYSTEM_WRITE)
  @Audit({
    domain: 'nginx',
    action: 'site.create',
    summary: (ctx) => {
      const command = (ctx.extra as { command: CreateNginxSiteDto }).command;
      return `Nginx 사이트 ${command.name}(${command.domain})를 생성했습니다.`;
    },
    targetType: 'site',
    targetId: (ctx) =>
      (ctx.extra as { command: CreateNginxSiteDto }).command.name,
    metadata: (ctx) => ({
      after: toSiteSnapshot(
        ctx.response as Parameters<typeof toSiteSnapshot>[0],
      ),
      testResult: (ctx.response as { testResult: { success: boolean } })
        .testResult.success,
    }),
  })
  async createSite(
    @Body() dto: CreateNginxSiteRequestDto,
    @Request() req: NginxRequest,
  ) {
    // 감사 요약·대상 ID는 정규화된 명령 값을 그대로 써야 하므로 인터셉터에 전달함
    const command = CreateNginxSiteDto.from(dto);
    req._auditExtra = { command };
    return this.createSiteUseCase.execute(command);
  }

  @Put('sites/:name')
  @RequirePermissions(PERMISSIONS.SYSTEM_WRITE)
  @Audit({
    domain: 'nginx',
    action: 'site.update',
    summary: (ctx) => `Nginx 사이트 ${ctx.params.name} 설정을 수정했습니다.`,
    targetType: 'site',
    targetId: (ctx) => ctx.params.name,
    metadata: (ctx) => ({
      before: (ctx.extra as { before?: unknown }).before ?? null,
      after: toSiteSnapshot(
        ctx.response as Parameters<typeof toSiteSnapshot>[0],
      ),
      testResult: (ctx.response as { testResult: { success: boolean } })
        .testResult.success,
    }),
  })
  async updateSite(
    @Param('name') name: string,
    @Body() dto: CreateNginxSiteRequestDto,
    @Request() req: NginxRequest,
  ) {
    // 변경 전 상태는 수정이 반영되기 전에만 조회할 수 있으므로 여기서 스냅샷을 남김
    req._auditExtra = { before: await this.getSiteSnapshot(name) };
    return this.updateSiteUseCase.execute(name, CreateNginxSiteDto.from(dto));
  }

  @Delete('sites/:name')
  @RequirePermissions(PERMISSIONS.SYSTEM_WRITE)
  @Audit({
    domain: 'nginx',
    action: 'site.delete',
    summary: (ctx) => `Nginx 사이트 ${ctx.params.name}를 삭제했습니다.`,
    targetType: 'site',
    targetId: (ctx) => ctx.params.name,
    metadata: (ctx) => ({
      before: (ctx.extra as { before?: unknown }).before ?? null,
      testResult: (ctx.response as { testResult: { success: boolean } })
        .testResult.success,
    }),
  })
  async deleteSite(@Param('name') name: string, @Request() req: NginxRequest) {
    // 삭제 후에는 조회할 수 없으므로 삭제 전에 스냅샷을 남김
    req._auditExtra = { before: await this.getSiteSnapshot(name) };
    return this.deleteSiteUseCase.execute(name);
  }

  /**
   * 사이트 활성화·비활성화 토글
   *
   * 토글 결과에 따라 action 이 site.enable / site.disable 로 갈리므로
   * action 도 컨텍스트 팩토리로 지정한다.
   */
  @Post('sites/:name/toggle')
  @RequirePermissions(PERMISSIONS.SYSTEM_WRITE)
  @Audit({
    domain: 'nginx',
    action: (ctx) =>
      (ctx.response as { enabled: boolean }).enabled
        ? 'site.enable'
        : 'site.disable',
    summary: (ctx) =>
      `Nginx 사이트 ${ctx.params.name}를 ${
        (ctx.response as { enabled: boolean }).enabled ? '활성화' : '비활성화'
      }했습니다.`,
    targetType: 'site',
    targetId: (ctx) => ctx.params.name,
    metadata: (ctx) => {
      const before = (ctx.extra as { before?: ReturnType<typeof toSiteSnapshot> })
        .before;
      const { enabled } = ctx.response as { enabled: boolean };
      return {
        before: before ?? null,
        // 토글은 enabled 만 바뀌므로 변경 전 스냅샷에 결과 값을 덮어써 after 를 만든다
        after: before ? { ...before, enabled } : { enabled },
        testResult: (ctx.response as { testResult: { success: boolean } })
          .testResult.success,
      };
    },
  })
  async toggleSite(@Param('name') name: string, @Request() req: NginxRequest) {
    // 토글 후에는 변경 전 상태를 알 수 없으므로 실행 전에 스냅샷을 남김
    req._auditExtra = { before: await this.getSiteSnapshot(name) };
    return this.toggleSiteUseCase.execute(name);
  }

  @Post('test')
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  testConfig() {
    return this.testConfigUseCase.execute();
  }

  @Post('reload')
  @RequirePermissions(PERMISSIONS.SYSTEM_WRITE)
  @Audit({
    domain: 'nginx',
    action: 'reload',
    summary: 'Nginx 리로드를 실행했습니다.',
    targetType: 'service',
    targetId: () => 'kscold-nginx',
  })
  reloadNginx() {
    return this.reloadNginxUseCase.execute();
  }

  /**
   * 프록시 설정에 쓸 컨테이너 업스트림 후보 조회
   * 실행 중인 컨테이너와 내부 포트 목록 반환
   */
  @Get('upstreams')
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  getUpstreams() {
    return this.getUpstreamsUseCase.execute();
  }

  // ===== SSL 인증서 엔드포인트 =====

  /**
   * SSL 인증서 전체 목록
   * GET /nginx/certs
   */
  @Get('certs')
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  listCerts() {
    return this.listCertsUseCase.execute();
  }

  /**
   * 새 SSL 인증서 발급
   * POST /nginx/certs/issue
   */
  @Post('certs/issue')
  @RequirePermissions(PERMISSIONS.SYSTEM_WRITE)
  @Audit({
    domain: 'nginx',
    action: 'cert.issue',
    summary: (ctx) =>
      `도메인 ${(ctx.body as { domain: string }).domain} 인증서 발급을 실행했습니다.`,
    targetType: 'certificate',
    targetId: (ctx) => (ctx.body as { domain: string }).domain,
    metadata: (ctx) => {
      const body = ctx.body as { email: string; mode?: string };
      return {
        email: body.email,
        mode: body.mode ?? 'webroot',
      };
    },
  })
  issueCert(@Body() body: { domain: string; email: string; mode?: string }) {
    return this.issueCertUseCase.execute(body.domain, body.email, body.mode);
  }

  /**
   * 인증서 전체 갱신
   * POST /nginx/certs/renew
   */
  @Post('certs/renew')
  @RequirePermissions(PERMISSIONS.SYSTEM_WRITE)
  @Audit({
    domain: 'nginx',
    action: 'cert.renew-all',
    summary: '인증서 전체 갱신을 실행했습니다.',
    targetType: 'certificate',
    targetId: () => 'all',
  })
  renewCerts() {
    return this.renewCertsUseCase.execute();
  }

  /**
   * 인증서 자동 갱신 스케줄 상태 (마지막 실행 결과 + 만료 요약)
   * GET /nginx/certs/renewal-status
   */
  @Get('certs/renewal-status')
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  getRenewalStatus() {
    return this.getRenewalStatusUseCase.execute();
  }

  // ===== DNS 관리 엔드포인트 =====

  /**
   * 이 서버의 공인 IP 조회
   * GET /nginx/dns/ip
   */
  @Get('dns/ip')
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  getPublicIp() {
    return this.getPublicIpUseCase.execute();
  }

  /**
   * 단일 도메인 DNS 검증
   * POST /nginx/dns/verify
   */
  @Post('dns/verify')
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  verifyDns(@Body() body: { domain: string }) {
    return this.verifyDnsUseCase.execute(body.domain);
  }

  /**
   * 설정된 모든 프록시 도메인 DNS 검증
   * GET /nginx/dns/verify-all
   */
  @Get('dns/verify-all')
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  verifyAllDns() {
    return this.verifyAllDnsUseCase.execute();
  }

  /** 변경 전 상태 기록용 — 현재 설정 목록에서 해당 사이트 스냅샷을 조회함 */
  private async getSiteSnapshot(name: string) {
    const items = await this.listSitesUseCase.execute();
    return toSiteSnapshot(items.find((item) => item.name === name) ?? null);
  }
}
