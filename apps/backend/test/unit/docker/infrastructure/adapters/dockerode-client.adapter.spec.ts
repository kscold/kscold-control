import Docker from 'dockerode';
import { homedir, platform } from 'node:os';
import * as path from 'node:path';
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

  it('DOCKER_HOST가 없으면 운영체제 기본 소켓을 사용한다', () => {
    const adapter = new DockerodeClientAdapter();

    adapter.onModuleInit();

    const socketPath =
      platform() === 'darwin'
        ? path.join(homedir(), '.colima', 'default', 'docker.sock')
        : '/var/run/docker.sock';

    expect(DockerMock).toHaveBeenCalledWith({
      socketPath,
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

  function processAdapter(output: string, ps = '') {
    const adapter = new DockerodeClientAdapter();
    adapter.onModuleInit();
    jest
      .spyOn(adapter as any, 'execCommand')
      .mockResolvedValueOnce(output)
      .mockResolvedValueOnce(ps);
    return adapter;
  }

  it('기존 PM2 목록은 환경 값을 제외하고 같은 구조로 반환한다', async () => {
    const adapter = processAdapter(
      'PM2\n' +
        JSON.stringify([
          {
            name: 'legacy-api',
            pid: 42,
            pm2_env: {
              status: 'online',
              restart_time: 2,
              PRIVATE_VALUE: 'not-for-response',
            },
            monit: { cpu: 3, memory: 4096 },
          },
        ]),
      'mongod --auth',
    );

    await expect(adapter.getContainerProcesses('legacy')).resolves.toEqual({
      pm2: [
        {
          name: 'legacy-api',
          pid: 42,
          status: 'online',
          restarts: 2,
          cpu: 3,
          memory: 4096,
        },
      ],
      supervisor: [],
      services: [{ name: 'MongoDB', port: 27017, icon: 'mongo' }],
    });
  });

  it('Supervisor 상태·PID·여러 날의 가동시간을 파싱하고 통합 이미지 포트를 중복 없이 반환한다', async () => {
    const adapter = processAdapter(
      `SUPERVISOR_BLOG
api                              RUNNING   pid 21, uptime 2 days, 3:04:05
web                              RUNNING   pid 22, uptime 0:01:02
agent                            RUNNING   pid 23, uptime 1 day, 0:00:01
mongod                           RUNNING   pid 10, uptime 0:04:00
qdrant                           RUNNING   pid 11, uptime 0:04:00
`,
      'mongod --auth\nqdrant --config-path /etc/qdrant/config.yaml',
    );
    const result = await adapter.getContainerProcesses('integrated');

    expect(result.pm2).toEqual([]);
    expect(result.supervisor).toEqual([
      { name: 'api', status: 'running', pid: 21, uptimeSeconds: 183845 },
      { name: 'web', status: 'running', pid: 22, uptimeSeconds: 62 },
      { name: 'agent', status: 'running', pid: 23, uptimeSeconds: 86401 },
      { name: 'mongod', status: 'running', pid: 10, uptimeSeconds: 240 },
      { name: 'qdrant', status: 'running', pid: 11, uptimeSeconds: 240 },
    ]);
    expect(result.services.map((entry) => entry.port)).toEqual([
      8080, 3000, 9090, 27017, 6333,
    ]);
  });

  it('중지·시작·실패 상태도 보존하며 가동 중이 아닌 프로그램의 포트를 추정하지 않는다', async () => {
    const adapter = processAdapter(`SUPERVISOR_BLOG
api STOPPED Not started
web STARTING
agent BACKOFF Exited too quickly
group:worker FATAL Exited too quickly
previous EXITED Oct 27 04:00 PM
unknown UNKNOWN
retiring STOPPING
unix:///run/blog/supervisor.sock no such file
`);
    const result = await adapter.getContainerProcesses('stopped-programs');

    expect(
      result.supervisor?.map(({ name, status }) => ({ name, status })),
    ).toEqual([
      { name: 'api', status: 'stopped' },
      { name: 'web', status: 'starting' },
      { name: 'agent', status: 'backoff' },
      { name: 'group:worker', status: 'fatal' },
      { name: 'previous', status: 'exited' },
      { name: 'unknown', status: 'unknown' },
      { name: 'retiring', status: 'stopping' },
    ]);
    expect(
      result.supervisor?.every(
        (process) => process.pid === null && process.uptimeSeconds === null,
      ),
    ).toBe(true);
    expect(result.services).toEqual([]);
  });

  it('다른 Supervisor 소켓의 api 이름만으로 블로그 포트를 추정하지 않는다', async () => {
    const adapter = processAdapter(
      'SUPERVISOR\napi RUNNING pid 5, uptime 0:00:10',
    );
    const result = await adapter.getContainerProcesses('another-stack');
    expect(result.supervisor).toHaveLength(1);
    expect(result.services).toEqual([]);
  });

  it.each(['', 'PM2\ninvalid json', 'SUPERVISOR\nerror: connection refused'])(
    '프로세스 관리자가 없거나 읽을 수 없어도 시스템 서비스 감지를 유지한다 (%s)',
    async (output) => {
      const adapter = processAdapter(output, 'postgres');
      await expect(
        adapter.getContainerProcesses('no-manager'),
      ).resolves.toEqual({
        pm2: [],
        supervisor: [],
        services: [{ name: 'PostgreSQL', port: 5432, icon: 'pg' }],
      });
    },
  );
});
