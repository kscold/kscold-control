import type { DockerCleanupCandidateItem } from '../types/docker-cleanup.type';

/**
 * 프로젝트의 배포·백업 부산물을 읽기 전용으로 조사하는 외부 연동 게이트웨이임.
 *
 * 정리 화면은 실제 삭제를 수행하지 않고 후보와 용량만 보여 줌.
 * 따라서 파일 탐색 구현은 인프라에 두고 애플리케이션에는 이 읽기 계약만 둠.
 */
export interface IDockerArtifactGateway {
  listArtifacts(
    relativePaths: readonly string[],
  ): Promise<DockerCleanupCandidateItem[]>;
}

export const DOCKER_ARTIFACT_GATEWAY = Symbol('DOCKER_ARTIFACT_GATEWAY');
