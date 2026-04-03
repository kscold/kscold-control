import Docker from 'dockerode';
import { DockerodeClientAdapter } from './dockerode-client.adapter';

jest.mock('dockerode', () => {
  return jest.fn().mockImplementation(() => ({
    listContainers: jest.fn(),
    getContainer: jest.fn(),
    createContainer: jest.fn(),
    pull: jest.fn(),
    modem: {
      followProgress: jest.fn(),
    },
  }));
});

describe('DockerodeClientAdapter', () => {
  const DockerMock = Docker as unknown as jest.Mock;
  const originalDockerHost = process.env.DOCKER_HOST;

  beforeEach(() => {
    DockerMock.mockClear();
    delete process.env.DOCKER_HOST;
  });

  afterAll(() => {
    if (originalDockerHost) {
      process.env.DOCKER_HOST = originalDockerHost;
      return;
    }

    delete process.env.DOCKER_HOST;
  });

  it('DOCKER_HOST가 없으면 Colima 기본 소켓을 사용한다', () => {
    const adapter = new DockerodeClientAdapter();

    adapter.onModuleInit();

    expect(DockerMock).toHaveBeenCalledWith({
      socketPath: '/Users/kscold/.colima/default/docker.sock',
    });
  });

  it('DOCKER_HOST가 있으면 해당 소켓 경로를 사용한다', () => {
    process.env.DOCKER_HOST = 'unix:///tmp/custom-docker.sock';
    const adapter = new DockerodeClientAdapter();

    adapter.onModuleInit();

    expect(DockerMock).toHaveBeenCalledWith({
      socketPath: '/tmp/custom-docker.sock',
    });
  });
});
