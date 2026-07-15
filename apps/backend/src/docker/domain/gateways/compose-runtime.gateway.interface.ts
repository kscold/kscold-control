import type { ComposeDocument } from '../types/compose.type';

/**
 * Compose YAML과 Docker Compose 명령 실행을 감추는 외부 연동 게이트웨이임.
 *
 * 애플리케이션은 서비스 이름, 포트 충돌, 보호 서비스, 롤백 정책만 판단함.
 * YAML 직렬화, 파일 쓰기, 자식 프로세스 실행은 이 계약의 구현체가 맡음.
 */
export interface IComposeRuntimeGateway {
  readCompose(): ComposeDocument;
  writeCompose(compose: ComposeDocument): void;
  listDockerHostPorts(): Promise<number[]>;
  upService(name: string): Promise<string>;
  downService(name: string): Promise<string>;
}

export const COMPOSE_RUNTIME_GATEWAY = Symbol('COMPOSE_RUNTIME_GATEWAY');
