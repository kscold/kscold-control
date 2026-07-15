import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  COMPOSE_RUNTIME_GATEWAY,
  type IComposeRuntimeGateway,
} from '../../domain/gateways/compose-runtime.gateway.interface';
import type {
  ComposeDocument,
  ComposeServiceDefinition,
} from '../../domain/types/compose.type';

const SAFE_COMPOSE_SERVICE_NAME = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,62}$/;
const PROTECTED_SERVICES = new Set(['nginx', 'kscold-infra-db']);
const MIN_HOST_PORT = 1;
const MAX_HOST_PORT = 65_535;

/**
 * docker-compose 서비스 생성에 쓰는 애플리케이션 입력임.
 *
 * ports의 키는 컨테이너 내부 포트, 값은 호스트에 공개할 포트임.
 * 예를 들어 { '22': 2227 }은 호스트 2227을 컨테이너 SSH 22로 연결함.
 */
export interface ComposeServiceConfig {
  name: string;
  image: string;
  ports: Record<string, number>;
  cpus: string;
  memLimit: string;
  command?: string;
  environment?: Record<string, string>;
}

/**
 * Compose 서비스 생성·삭제 정책 담당함.
 *
 * 이 계층은 서비스 이름 검증, 포트 충돌, 보호 서비스, 롤백 순서만 판단함.
 * YAML 변환, 파일 시스템 접근, Docker Compose 실행은 게이트웨이 구현체로 위임해
 * 애플리케이션 규칙이 운영 환경의 경로·프로세스 세부에 의존하지 않게 함.
 */
@Injectable()
export class ComposeService {
  private readonly logger = new Logger(ComposeService.name);

  constructor(
    @Inject(COMPOSE_RUNTIME_GATEWAY)
    private readonly composeRuntime: IComposeRuntimeGateway,
  ) {}

  readCompose(): ComposeDocument {
    return this.composeRuntime.readCompose();
  }

  listServices(): string[] {
    return Object.keys(this.readCompose().services ?? {});
  }

  hasService(name: string): boolean {
    this.assertSafeServiceName(name);
    return Boolean(this.readCompose().services?.[name]);
  }

  async getUsedHostPorts(): Promise<Set<number>> {
    /*
     * 아직 실행하지 않은 compose 정의도 다음 생성 요청과 충돌할 수 있음.
     * 따라서 YAML에 선언된 포트와 Docker가 실제로 바인딩한 포트를 합쳐 판단함.
     * Docker 조회가 실패해도 정의 파일 기준 검사는 유지해 서비스 생성 전체가 막히지
     * 않도록 하되, 운영자가 알 수 있게 경고 남김.
     */
    const usedPorts = this.getComposeHostPorts(this.readCompose());

    try {
      for (const port of await this.composeRuntime.listDockerHostPorts()) {
        usedPorts.add(port);
      }
    } catch {
      this.logger.warn(
        'Docker 포트 목록을 읽지 못해 compose 기준만 사용합니다.',
      );
    }

    return usedPorts;
  }

  async ensurePortsAvailable(ports: Record<string, number>): Promise<void> {
    const requestedPorts = Object.values(ports);
    const invalidPorts = requestedPorts.filter(
      (port) =>
        !Number.isInteger(port) || port < MIN_HOST_PORT || port > MAX_HOST_PORT,
    );

    if (invalidPorts.length > 0) {
      throw new BadRequestException(
        `호스트 포트는 ${MIN_HOST_PORT}부터 ${MAX_HOST_PORT} 사이의 정수여야 합니다: ${invalidPorts.join(', ')}`,
      );
    }

    const seenPorts = new Set<number>();
    const duplicatedPorts = requestedPorts.filter((port) => {
      if (seenPorts.has(port)) {
        return true;
      }

      seenPorts.add(port);
      return false;
    });

    if (duplicatedPorts.length > 0) {
      throw new BadRequestException(
        `같은 호스트 포트를 둘 이상의 컨테이너 포트에 연결할 수 없습니다: ${[
          ...new Set(duplicatedPorts),
        ].join(', ')}`,
      );
    }

    const usedPorts = await this.getUsedHostPorts();
    const conflictedPorts = requestedPorts.filter((port) =>
      usedPorts.has(port),
    );

    if (conflictedPorts.length > 0) {
      throw new BadRequestException(
        `이미 사용 중인 포트가 있습니다: ${conflictedPorts.join(', ')}`,
      );
    }
  }

  addService(config: ComposeServiceConfig): void {
    this.assertSafeServiceName(config.name);
    const compose = this.readCompose();
    const services = (compose.services ??= {});

    if (services[config.name]) {
      throw new Error(
        `docker-compose.yml에 이미 존재하는 서비스입니다: ${config.name}`,
      );
    }

    /*
     * 애플리케이션 입력의 { 내부 포트: 호스트 포트 } 표현을 Compose YAML의
     * "호스트:내부" 문자열 배열로 바꿉니다. 이 변환을 한 곳에 두면 호출자가
     * YAML 문법을 알아야 하거나 포트 순서를 잘못 뒤집는 일을 막을 수 있음.
     */
    const service: ComposeServiceDefinition = {
      image: config.image,
      container_name: config.name,
      command: config.command || 'sleep infinity',
      ports: Object.entries(config.ports).map(
        ([internal, external]) => `${external}:${internal}`,
      ),
      cpus: config.cpus,
      mem_limit: config.memLimit,
      restart: 'unless-stopped',
    };

    if (config.environment && Object.keys(config.environment).length > 0) {
      service.environment = config.environment;
    }

    services[config.name] = service;
    this.composeRuntime.writeCompose(compose);
    this.logger.log(`Compose 서비스를 추가했습니다: ${config.name}`);
  }

  removeService(name: string): void {
    this.assertSafeServiceName(name);
    const compose = this.readCompose();
    const services = compose.services ?? {};

    if (!services[name]) {
      throw new Error(
        `docker-compose.yml에서 서비스를 찾을 수 없습니다: ${name}`,
      );
    }

    if (PROTECTED_SERVICES.has(name)) {
      throw new Error(`핵심 인프라 서비스는 제거할 수 없습니다: ${name}`);
    }

    delete services[name];
    /*
     * 삭제 대상에 의존하는 서비스가 남으면 다음 compose up에서 이름 해석 오류 발생함.
     * 배열형과 조건형 객체의 depends_on 모두에서 대상 이름을 제거함. 조건형 객체는
     * 남은 조건 구성을 보존하고 대상 항목만 제거함.
     */
    for (const service of Object.values(services)) {
      if (Array.isArray(service.depends_on)) {
        service.depends_on = service.depends_on.filter(
          (dependency) => dependency !== name,
        );
        if (service.depends_on.length === 0) {
          delete service.depends_on;
        }
      }

      if (
        service.depends_on &&
        !Array.isArray(service.depends_on) &&
        typeof service.depends_on === 'object'
      ) {
        delete service.depends_on[name];
        if (Object.keys(service.depends_on).length === 0) {
          delete service.depends_on;
        }
      }
    }

    this.composeRuntime.writeCompose(compose);
    this.logger.log(`Compose 서비스를 제거했습니다: ${name}`);
  }

  async upService(name: string): Promise<string> {
    this.assertSafeServiceName(name);
    return this.composeRuntime.upService(name);
  }

  async downService(name: string): Promise<string> {
    this.assertSafeServiceName(name);
    return this.composeRuntime.downService(name);
  }

  async rollbackServiceCreation(name: string): Promise<void> {
    this.assertSafeServiceName(name);
    /*
     * 서비스 추가 뒤 컨테이너 기동·가져오기 중 어느 단계에서 실패해도 같은 상태로
     * 되돌립니다. 먼저 실행 중일 수 있는 컨테이너를 제거하고, 그 실패 여부와 무관하게
     * YAML 정의까지 제거해야 다음 요청이 같은 이름·포트를 다시 사용할 수 있음.
     */
    try {
      await this.composeRuntime.downService(name);
    } catch {
      this.logger.warn(`롤백 중 Compose 컨테이너 제거에 실패했습니다: ${name}`);
    }

    if (this.hasService(name)) {
      this.removeService(name);
    }
  }

  getServiceConfig(name: string): ComposeServiceDefinition | null {
    this.assertSafeServiceName(name);
    return this.readCompose().services?.[name] ?? null;
  }

  private getComposeHostPorts(compose: ComposeDocument): Set<number> {
    const ports = new Set<number>();

    for (const service of Object.values(compose.services ?? {})) {
      for (const rawPort of service.ports ?? []) {
        const hostPort = this.extractExplicitHostPort(rawPort);
        if (hostPort !== null) {
          ports.add(hostPort);
        }
      }
    }

    return ports;
  }

  /**
   * Compose 단축 포트 표기에서 호스트 포트만 추출함.
   *
   * "8080:80"뿐 아니라 "127.0.0.1:8080:80", "[::1]:8080:80"처럼
   * 주소가 앞에 붙는 경우에도 끝에서 두 번째 요소가 호스트 포트임.
   * 내부 포트만 쓴 "8080"은 Docker가 임의 호스트 포트를 배정하므로
   * 충돌 검사 대상에 넣지 않음.
   */
  private extractExplicitHostPort(rawPort: string | number): number | null {
    const parts = String(rawPort).split(':');
    if (parts.length < 2) {
      return null;
    }

    const candidate = parts.at(-2);
    const port = Number(candidate);

    return Number.isInteger(port) &&
      port >= MIN_HOST_PORT &&
      port <= MAX_HOST_PORT
      ? port
      : null;
  }

  private assertSafeServiceName(name: string): void {
    if (!SAFE_COMPOSE_SERVICE_NAME.test(name)) {
      throw new BadRequestException(
        '서비스 이름은 영문/숫자로 시작하고 영문, 숫자, 점, 밑줄, 하이픈만 사용할 수 있습니다.',
      );
    }
  }
}
