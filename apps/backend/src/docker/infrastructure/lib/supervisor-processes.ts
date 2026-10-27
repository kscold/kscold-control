import type {
  DockerDetectedService,
  DockerSupervisorProcess,
} from '../../domain/gateways/docker-client.gateway.interface';

// 상태 조회만 수행하며, PM2가 설치된 기존 컨테이너는 기존 경로를 유지함.
export const READ_MANAGED_PROCESSES = `
if command -v pm2 >/dev/null 2>&1; then
  printf 'PM2\\n'
  pm2 jlist 2>/dev/null
elif command -v supervisorctl >/dev/null 2>&1; then
  if [ -S /run/blog/supervisor.sock ]; then
    printf 'SUPERVISOR_BLOG\\n'
    supervisorctl -s unix:///run/blog/supervisor.sock status 2>/dev/null
  else
    printf 'SUPERVISOR\\n'
    supervisorctl status 2>/dev/null
  fi
fi
`;

export function parseSupervisorStatus(
  output: string,
): DockerSupervisorProcess[] {
  const processes: DockerSupervisorProcess[] = [];
  for (const line of output.split(/\r?\n/)) {
    const match = line
      .trim()
      .match(
        /^(\S+)\s+(STOPPED|STARTING|RUNNING|BACKOFF|STOPPING|EXITED|FATAL|UNKNOWN)\b(.*)$/,
      );
    if (!match) continue;
    const [, name, status, details] = match;
    const pid = details.match(/\bpid (\d+)\b/);
    const uptime = details.match(
      /\buptime (?:(\d+) days?, )?(\d+):(\d{2}):(\d{2})\b/,
    );
    processes.push({
      name,
      status: status.toLowerCase(),
      pid: pid ? Number(pid[1]) : null,
      uptimeSeconds: uptime
        ? Number(uptime[1] ?? 0) * 86400 +
          Number(uptime[2]) * 3600 +
          Number(uptime[3]) * 60 +
          Number(uptime[4])
        : null,
    });
  }
  return processes;
}

/** /run/blog/supervisor.sock을 사용하는 통합 이미지의 프로그램·포트 계약임. */
export function getBlogSupervisorServices(
  processes: DockerSupervisorProcess[],
): DockerDetectedService[] {
  const services: Record<string, DockerDetectedService> = {
    api: { name: 'API', port: 8080, icon: 'api' },
    web: { name: 'Web', port: 3000, icon: 'web' },
    agent: { name: 'Vault Agent', port: 9090, icon: 'agent' },
    mongod: { name: 'MongoDB', port: 27017, icon: 'mongo' },
    qdrant: { name: 'Qdrant', port: 6333, icon: 'vector' },
  };
  return processes
    .filter((process) => process.status === 'running')
    .flatMap((process) => {
      const service = services[process.name.split(':').at(-1) ?? ''];
      return service ? [service] : [];
    });
}
