/**
 * Docker 정리 작업을 수행하는 외부 연동 게이트웨이임.
 *
 * 애플리케이션은 Docker 명령 문자열을 조합하지 않고, 이 계약에 정의된 업무 단위만
 * 호출함. 구현체는 고정된 인수 배열로 Docker 프로세스를 실행하므로 외부 입력이
 * 셸 명령으로 해석될 가능성을 차단함.
 */
export interface IDockerCleanupGateway {
  getUsageSummary(): Promise<string>;
  getDetailedUsage(): Promise<string>;
  pruneDanglingImages(): Promise<string>;
  pruneExitedContainers(): Promise<string>;
  pruneDanglingVolumes(): Promise<string>;
  pruneBuildCache(): Promise<string>;
}

export const DOCKER_CLEANUP_GATEWAY = Symbol('DOCKER_CLEANUP_GATEWAY');
