import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveDockerConnectionOptions } from '@/common/utils/docker-host.util';

afterEach(() => vi.unstubAllEnvs());

describe('resolveDockerConnectionOptions', () => {
  it('Unix 소켓 주소를 socketPath 로 바꾼다', () => {
    vi.stubEnv('DOCKER_HOST', 'unix:///var/run/docker.sock');
    expect(resolveDockerConnectionOptions()).toEqual({
      socketPath: '/var/run/docker.sock',
    });
  });

  it('윈도우 이름 있는 파이프 주소를 Dockerode 가 읽는 경로로 바꾼다', () => {
    vi.stubEnv('DOCKER_HOST', 'npipe:////./pipe/docker_engine');
    expect(resolveDockerConnectionOptions()).toEqual({
      socketPath: '\\\\.\\pipe\\docker_engine',
    });
  });

  it('tcp 주소는 host·port 로 나눈다', () => {
    vi.stubEnv('DOCKER_HOST', 'tcp://203.0.113.10:2375');
    expect(resolveDockerConnectionOptions()).toEqual({
      host: '203.0.113.10',
      port: 2375,
      protocol: 'http',
    });
  });
});
