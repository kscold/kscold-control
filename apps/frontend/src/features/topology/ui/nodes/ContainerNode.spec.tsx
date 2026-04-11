import { render, screen } from '@testing-library/react';
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
            label: 'Slacord',
            image: 'kscold/ubuntu-slacord:latest',
            status: 'running',
            ports: { '3002': 3003, '8082': 8084 },
            domains: ['slacord.cloud'],
            gateway: {
              mode: 'host-nginx',
              label: '공용 kscold-nginx 프록시',
              details: [
                '실제 웹 도메인은 공용 kscold-nginx가 앞단에서 종료합니다.',
                '이 Ubuntu 컨테이너 안에는 별도 Nginx가 없고, 앱 포트만 직접 노출됩니다.',
              ],
            },
            meta: {
              label: 'Slacord',
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

    expect(screen.getByText('slacord.cloud')).toBeInTheDocument();
    expect(screen.getByText('공용 kscold-nginx 프록시')).toBeInTheDocument();
    expect(screen.getByText(/별도 Nginx가 없고/)).toBeInTheDocument();
  });
});
