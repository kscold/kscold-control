import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DOCKER_CLIENT,
  type IDockerClient,
} from '../../domain/gateways/docker-client.gateway.interface';

const COMPOSE_PROJECT_LABEL = 'com.docker.compose.project';

/**
 * compose 스택(같은 project 라벨) 컨테이너를 모두 재시작한다.
 * 스택에는 남의 컨테이너가 섞일 수 있어 전역 관리자만 쓸 수 있다.
 */
@Injectable()
export class RestartStackUseCase {
  constructor(@Inject(DOCKER_CLIENT) private readonly docker: IDockerClient) {}

  async execute(
    project: string,
    ownerId?: string,
  ): Promise<{ restarted: string[] }> {
    if (ownerId) {
      throw new ForbiddenException('스택 재시작은 관리자만 할 수 있습니다.');
    }
    const members = (await this.docker.listContainers(true)).filter(
      (container) => container.labels?.[COMPOSE_PROJECT_LABEL] === project,
    );
    if (members.length === 0) {
      throw new NotFoundException(`스택 ${project} 를 찾을 수 없습니다.`);
    }
    // 같은 스택 안 의존 순서를 모르므로 하나씩 차례로 재시작한다
    for (const member of members) {
      await this.docker.restartContainer(member.id);
    }
    return { restarted: members.map((member) => member.name) };
  }
}
