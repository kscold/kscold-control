import { Injectable } from '@nestjs/common';
import { ListContainersUseCase } from '../../../docker/application/use-cases';

/** 실행 중인 컨테이너를 Nginx upstream 후보로 변환함. */
@Injectable()
export class GetNginxUpstreamsUseCase {
  constructor(private readonly listContainers: ListContainersUseCase) {}

  async execute() {
    const containers = await this.listContainers.execute();
    return containers
      .filter((c) => c.liveStatus === 'running')
      .map((c) => {
        const upstreams: Array<{ label: string; value: string }> = [];
        for (const [internal] of Object.entries(c.ports)) {
          upstreams.push({
            label: `${c.name}:${internal}`,
            value: `http://${c.name}:${internal}`,
          });
        }
        return {
          name: c.name,
          image: c.image,
          status: c.liveStatus,
          upstreams,
        };
      });
  }
}
