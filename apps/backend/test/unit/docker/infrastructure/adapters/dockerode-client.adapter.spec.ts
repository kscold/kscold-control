import Docker from 'dockerode';
import { PassThrough } from 'node:stream';
import { DockerodeClientAdapter } from '@/docker/infrastructure/adapters/dockerode-client.adapter';

jest.mock('dockerode', () => {
  return jest.fn().mockImplementation(() => ({
    listContainers: jest.fn(),
    getContainer: jest.fn(),
    createContainer: jest.fn(),
    pull: jest.fn(),
    modem: {
      followProgress: jest.fn(),
      demuxStream: jest.fn(),
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

  it('컨테이너 명령 출력은 Docker 멀티플렉스 해제기를 통해 읽는다', async () => {
    const adapter = new DockerodeClientAdapter();
    adapter.onModuleInit();
    const docker = DockerMock.mock.results.at(-1)?.value;
    const stream = new PassThrough();
    const exec = {
      start: jest.fn().mockResolvedValue(stream),
    };
    const container = {
      exec: jest.fn().mockResolvedValue(exec),
    };

    docker.modem.demuxStream.mockImplementation(
      (source: NodeJS.ReadableStream, stdout: NodeJS.WritableStream) =>
        source.pipe(stdout),
    );

    const output = (adapter as any).execCommand(container, [
      'sh',
      '-c',
      'echo',
    ]);
    await new Promise((resolve) => setImmediate(resolve));
    stream.write(Buffer.from('긴 출력의 첫 부분'));
    stream.end(Buffer.from('과 두 번째 부분'));

    await expect(output).resolves.toBe('긴 출력의 첫 부분과 두 번째 부분');
    expect(docker.modem.demuxStream).toHaveBeenCalledWith(
      stream,
      expect.any(PassThrough),
      expect.any(PassThrough),
    );
  });
});
