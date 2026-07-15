import { BadRequestException } from '@nestjs/common';
import { type ComposeDocument } from '@/docker/domain/types/compose.type';
import { type IComposeRuntimeGateway } from '@/docker/domain/gateways/compose-runtime.gateway.interface';
import { ComposeService } from '@/docker/application/services/compose.service';

describe('ComposeService', () => {
  let compose: ComposeDocument;
  let composeRuntime: jest.Mocked<IComposeRuntimeGateway>;
  let service: ComposeService;

  beforeEach(() => {
    compose = {
      services: {
        nginx: {
          image: 'nginx:latest',
          ports: ['80:80'],
        },
      },
    };
    composeRuntime = {
      readCompose: jest.fn(() => compose),
      writeCompose: jest.fn(),
      listDockerHostPorts: jest.fn().mockResolvedValue([]),
      upService: jest.fn(),
      downService: jest.fn(),
    };
    service = new ComposeService(composeRuntime);
  });

  it('서비스 입력을 Compose 포트 형식으로 변환해 저장한다', () => {
    service.addService({
      name: 'ubuntu-test',
      image: 'ubuntu:22.04',
      ports: { '22': 2227, '8080': 8085 },
      cpus: '2',
      memLimit: '4g',
      environment: { TZ: 'Asia/Seoul' },
    });

    expect(compose.services?.['ubuntu-test']).toEqual({
      image: 'ubuntu:22.04',
      container_name: 'ubuntu-test',
      command: 'sleep infinity',
      ports: ['2227:22', '8085:8080'],
      cpus: '2',
      mem_limit: '4g',
      restart: 'unless-stopped',
      environment: { TZ: 'Asia/Seoul' },
    });
    expect(composeRuntime.writeCompose).toHaveBeenCalledWith(compose);
  });

  it('주소가 포함된 Compose 포트와 실행 중 Docker 포트를 모두 충돌 대상으로 본다', async () => {
    compose.services = {
      bound: {
        ports: ['127.0.0.1:2227:22', '[::1]:8085:8080'],
      },
    };
    composeRuntime.listDockerHostPorts.mockResolvedValue([9090]);

    await expect(
      service.ensurePortsAvailable({ '22': 2227, '80': 9090 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('한 요청에서 같은 호스트 포트를 중복 지정하면 Docker 실행 전에 거부한다', async () => {
    await expect(
      service.ensurePortsAvailable({ '22': 2227, '8080': 2227 }),
    ).rejects.toThrow(
      '같은 호스트 포트를 둘 이상의 컨테이너 포트에 연결할 수 없습니다',
    );
  });

  it('서비스 삭제 시 배열형과 조건형 depends_on 참조를 함께 제거한다', () => {
    compose.services = {
      temporary: { image: 'ubuntu:22.04' },
      arrayDependent: {
        image: 'example:latest',
        depends_on: ['temporary', 'nginx'],
      },
      objectDependent: {
        image: 'example:latest',
        depends_on: {
          temporary: { condition: 'service_started' },
          nginx: { condition: 'service_started' },
        },
      },
    };

    service.removeService('temporary');

    expect(compose.services?.temporary).toBeUndefined();
    expect(compose.services?.arrayDependent.depends_on).toEqual(['nginx']);
    expect(compose.services?.objectDependent.depends_on).toEqual({
      nginx: { condition: 'service_started' },
    });
    expect(composeRuntime.writeCompose).toHaveBeenCalledWith(compose);
  });

  it('컨테이너 제거가 실패해도 Compose 정의는 롤백한다', async () => {
    compose.services = {
      temporary: { image: 'ubuntu:22.04' },
    };
    composeRuntime.downService.mockRejectedValue(new Error('이미 제거됨'));

    await service.rollbackServiceCreation('temporary');

    expect(composeRuntime.downService).toHaveBeenCalledWith('temporary');
    expect(compose.services?.temporary).toBeUndefined();
    expect(composeRuntime.writeCompose).toHaveBeenCalledWith(compose);
  });
});
