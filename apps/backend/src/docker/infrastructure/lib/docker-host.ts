import { homedir, platform } from 'node:os';
import * as path from 'node:path';

type DockerConnectionOptions =
  | { socketPath: string }
  | { host: string; port: number; protocol: 'http' | 'https' };

/**
 * 현재 호스트에서 Docker 엔진에 연결할 주소 결정함.
 *
 * 운영 환경에서 DOCKER_HOST를 지정하면 그 값을 최우선으로 사용함. 지정하지 않은
 * macOS 개발 환경은 현재 사용자 홈의 Colima 소켓을, Linux 환경은 Docker 기본 소켓을
 * 사용함. 특정 사용자 절대 경로를 코드에 박아 두지 않아 배포 위치가 달라도 동작함.
 */
export function resolveDockerHost(): string {
  if (process.env.DOCKER_HOST) {
    return process.env.DOCKER_HOST;
  }

  if (platform() === 'darwin') {
    return `unix://${path.join(
      homedir(),
      '.colima',
      'default',
      'docker.sock',
    )}`;
  }

  return 'unix:///var/run/docker.sock';
}

/**
 * Dockerode 생성자가 요구하는 연결 옵션으로 변환함.
 *
 * Docker 명령줄 도구는 DOCKER_HOST 문자열을 그대로 받지만 Dockerode는 Unix 소켓과
 * TCP 연결을 다른 옵션으로 받음. 여기서 한 번만 해석해 세 어댑터가
 * 동일한 Docker 엔진을 바라보게 함.
 */
export function resolveDockerConnectionOptions(): DockerConnectionOptions {
  const dockerHost = resolveDockerHost();

  if (dockerHost.startsWith('unix://')) {
    return { socketPath: dockerHost.slice('unix://'.length) };
  }

  const url = new URL(dockerHost.replace(/^tcp:/, 'http:'));
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(
      `지원하지 않는 Docker 연결 프로토콜입니다: ${url.protocol}`,
    );
  }

  return {
    host: url.hostname,
    port: Number(url.port || (url.protocol === 'https:' ? 2376 : 2375)),
    protocol: url.protocol.slice(0, -1) as 'http' | 'https',
  };
}
