/**
 * Docker API가 반환한 컨테이너의 현재 상태임.
 *
 * 이 값은 Dockerode의 응답 형식을 애플리케이션 계층으로 전파하지 않도록
 * 필요한 필드만 추린 게이트웨이 계약임.
 */
export interface DockerContainerInfo {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  ports: Array<{
    privatePort: number;
    publicPort?: number;
    type: string;
  }>;
  created: number;
}

/**
 * 컨테이너 자원 사용량임.
 *
 * Docker 엔진의 세부 응답 대신 화면과 유스케이스가 공통으로 사용하는
 * CPU, 메모리, 네트워크 수치만 노출함.
 */
export interface DockerContainerStats {
  cpuUsage: number;
  memoryUsage: number;
  memoryLimit: number;
  networkIn: number;
  networkOut: number;
}

/**
 * 컨테이너 생성에 필요한 Docker 게이트웨이 입력임.
 *
 * 애플리케이션은 이 구조만 알고, 실제 Docker API의 HostConfig나
 * ExposedPorts 변환은 인프라 어댑터에서 수행함.
 */
export interface DockerContainerConfig {
  name: string;
  image: string;
  ports: Record<string, number>;
  resources: {
    cpus: number;
    memory: string;
  };
  environment?: Record<string, string>;
}

/** 컨테이너 안에서 PM2 가 관리하는 프로세스 한 건 */
export interface DockerPm2Process {
  name: string;
  status: string;
  pid: number | null;
  /** CPU 사용률(%) */
  cpu: number;
  /** 메모리 사용량(바이트) */
  memory: number;
  /** 재시작 횟수 */
  restarts: number;
}

/** 컨테이너 안에서 감지된 서비스 한 건 (토폴로지 연결용) */
export interface DockerDetectedService {
  name: string;
  port: number;
  icon: string;
}

/**
 * 컨테이너 내부 프로세스를 토폴로지와 상세 화면에서 공통으로 쓰는 형태임.
 *
 * PM2 원본 응답에서 화면에 필요한 필드만 뽑아 정규화하므로 구조가 고정돼 있다.
 * 도메인 계약에 any 를 두면 인프라의 불확실성이 상위 계층까지 새어 나가므로
 * 실제 정규화 결과를 그대로 타입으로 표현한다.
 */
export interface DockerContainerProcesses {
  pm2: DockerPm2Process[];
  services: DockerDetectedService[];
}

/**
 * Docker 엔진과 통신하는 외부 연동 게이트웨이임.
 *
 * 애플리케이션은 이 계약으로 컨테이너를 제어하므로 Dockerode, 소켓 경로,
 * HTTP 클라이언트 같은 구현 세부는 인프라에만 남음.
 */
export interface IDockerClient {
  /** 실행 중인 항목만 또는 중지된 항목까지 포함해 컨테이너 조회함. */
  listContainers(all?: boolean): Promise<DockerContainerInfo[]>;

  /** 설정을 Docker API 형식으로 변환해 컨테이너를 만들고 Docker ID 반환함. */
  createContainer(config: DockerContainerConfig): Promise<string>;

  /** 지정한 Docker ID의 컨테이너 시작함. */
  startContainer(dockerId: string): Promise<void>;

  /** 지정한 Docker ID의 컨테이너 중지함. */
  stopContainer(dockerId: string): Promise<void>;

  /** 지정한 Docker ID의 컨테이너 삭제함. */
  removeContainer(dockerId: string): Promise<void>;

  /** 현재 자원 사용량 조회함. */
  getStats(dockerId: string): Promise<DockerContainerStats>;

  /** 최근 로그 행 조회함. */
  getLogs(dockerId: string, lines?: number): Promise<string[]>;

  /** 이미지가 없을 때 레지스트리에서 내려받음. */
  pullImage(image: string): Promise<void>;

  /** Compose 라벨처럼 목록 조회에 없는 상세 메타데이터 조회함. */
  inspectContainer(dockerId: string): Promise<any>;

  /**
   * 컨테이너 내부의 PM2와 시스템 서비스 조회함.
   *
   * 토폴로지는 이 결과를 컨테이너 하위 노드와 연결선으로 표현하므로,
   * 어댑터가 실행 명령의 결과를 이 안정적인 형태로 정규화해야 함.
   */
  getContainerProcesses(dockerId: string): Promise<DockerContainerProcesses>;
}

/** Nest 의존성 주입에서 Docker 게이트웨이 구현체를 연결하는 토큰임. */
export const DOCKER_CLIENT = Symbol('DOCKER_CLIENT');
