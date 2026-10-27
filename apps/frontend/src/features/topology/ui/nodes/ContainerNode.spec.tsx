import { render, screen } from '@testing-library/react';
import type { NodeProps } from '@xyflow/react';
import type { ContainerNodeData } from '@/entities/container';
import { ContainerNode } from './ContainerNode';

vi.mock('@xyflow/react', () => ({
  Handle: () => <div data-testid="handle" />,
  Position: {
    Top: 'top',
    Bottom: 'bottom',
  },
}));

describe('ContainerNode', () => {
  it('도메인과 웹 게이트웨이 정보를 함께 렌더링한다', () => {
    render(
      <ContainerNode
        {...({
          id: 'node-1',
          data: {
            label: 'ubuntu-projectdelta',
            image: 'example/ubuntu-projectdelta:latest',
            status: 'running',
            ports: { '3002': 3003, '8082': 8084 },
            domains: ['projectdelta.example.com'],
            gateway: {
              mode: 'host-nginx',
              label: '공용 kscold-nginx 프록시',
              details: [
                '실제 웹 도메인은 공용 kscold-nginx가 앞단에서 종료합니다.',
                '이 Ubuntu 컨테이너 안에는 별도 Nginx가 없고, 앱 포트만 직접 노출됩니다.',
              ],
            },
            meta: {
              label: 'ProjectDelta',
              type: 'app',
              color: 'border-emerald-500',
              shadowColor: 'shadow-emerald-500/20',
              headerBg: 'bg-emerald-950',
              stacks: [],
              knownServices: [],
            },
            processes: {
              pm2: [],
              services: [{ name: 'MongoDB', port: 27017, icon: 'mongo' }],
            },
          },
        } as any)}
      />,
    );

    expect(screen.getByText('projectdelta.example.com')).toBeInTheDocument();
    expect(screen.getByText('공용 kscold-nginx 프록시')).toBeInTheDocument();
    expect(screen.getByText(/별도 Nginx가 없고/)).toBeInTheDocument();
    expect(screen.getByTitle('ubuntu-projectdelta')).toHaveTextContent(
      'ubuntu-projectdelta',
    );
    expect(screen.getByText('ProjectDelta')).toBeInTheDocument();
  });

  function renderProcesses(
    processes: ContainerNodeData['processes'],
    label = 'ubuntu-blog',
    alias = 'Blog',
  ) {
    const data: ContainerNodeData = {
      label,
      image: 'example/blog:date',
      status: 'running',
      ports: {},
      meta: {
        label: alias,
        type: 'app',
        color: '',
        shadowColor: '',
        headerBg: '',
        stacks: [],
        knownServices: [],
      },
      processes,
    };
    render(
      <ContainerNode {...({ id: 'node-1', data } as unknown as NodeProps)} />,
    );
  }

  it('Supervisor 프로그램의 상태와 PID 및 가동시간을 표시한다', () => {
    renderProcesses({
      pm2: [],
      services: [{ name: 'API', port: 8080, icon: 'api' }],
      supervisor: [
        { name: 'api', status: 'running', pid: 24, uptimeSeconds: 7384 },
        { name: 'agent', status: 'backoff', pid: null, uptimeSeconds: null },
        { name: 'web', status: 'starting', pid: null, uptimeSeconds: null },
      ],
    });

    expect(screen.getByTitle('ubuntu-blog')).toHaveTextContent('ubuntu-blog');
    expect(screen.getByText('Blog')).toBeInTheDocument();
    expect(screen.getByText('Supervisor Processes')).toBeInTheDocument();
    expect(screen.getByText('PID 24')).toBeInTheDocument();
    expect(screen.getByText('가동 2h 3m')).toBeInTheDocument();
    expect(screen.getByText('backoff')).toBeInTheDocument();
    expect(screen.getByText('starting')).toBeInTheDocument();
    expect(screen.getAllByText('PID —')).toHaveLength(2);
    expect(screen.getByText(':8080')).toBeInTheDocument();
    expect(screen.queryByText('PM2 Processes')).not.toBeInTheDocument();
  });

  it('Supervisor 필드가 없는 기존 PM2 응답도 그대로 표시한다', () => {
    renderProcesses({
      pm2: [
        {
          name: 'legacy-api',
          status: 'online',
          cpu: 5,
          memory: 1024,
          restarts: 2,
        },
      ],
      services: [],
    });
    expect(screen.getByText('PM2 Processes')).toBeInTheDocument();
    expect(screen.getByText('legacy-api')).toBeInTheDocument();
    expect(screen.getByText('1.0 KB')).toBeInTheDocument();
    expect(screen.queryByText('Supervisor Processes')).not.toBeInTheDocument();
  });

  it('관리자가 없을 때 빈 프로세스 영역이나 중복 부제를 표시하지 않는다', () => {
    renderProcesses(
      { pm2: [], supervisor: [], services: [] },
      'kscold-control',
      'kscold-control',
    );
    expect(screen.getAllByText('kscold-control')).toHaveLength(1);
    expect(screen.queryByText('PM2 Processes')).not.toBeInTheDocument();
    expect(screen.queryByText('Supervisor Processes')).not.toBeInTheDocument();
  });
});
