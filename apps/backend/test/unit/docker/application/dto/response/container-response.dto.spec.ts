import { instanceToPlain } from 'class-transformer';
import { ContainerResponseDto } from '@/docker/application/dto';
import { Container } from '@/docker/domain/entities/container.entity';

describe('ContainerResponseDto', () => {
  it('영속 엔티티의 노출 허용 필드만 응답으로 변환함', () => {
    const container = {
      id: 'container-1',
      dockerId: 'docker-1',
      name: 'blog-api',
      image: 'ubuntu:22.04',
      status: 'running',
      ports: { '8080': 3000 },
      resources: { cpus: 2, memory: '4g', disk: '20g' },
      environment: { DATABASE_PASSWORD: 'secret' },
      userId: 'user-1',
      createdAt: new Date('2026-07-15T00:00:00.000Z'),
      updatedAt: new Date('2026-07-15T00:00:00.000Z'),
    } as unknown as Container;

    const response = ContainerResponseDto.fromEntity(container, 'running', {
      domain: 'kscold.iptime.org',
      http: 'http://kscold.iptime.org:3000',
    });
    const plain = instanceToPlain(response, {
      excludeExtraneousValues: true,
    });

    expect(response).toBeInstanceOf(ContainerResponseDto);
    expect(plain).toMatchObject({
      id: 'container-1',
      resources: { cpus: 2, memory: '4g' },
      externalAccess: { domain: 'kscold.iptime.org' },
    });
    expect(plain).not.toHaveProperty('environment');
    expect(plain.resources).not.toHaveProperty('disk');
  });
});
