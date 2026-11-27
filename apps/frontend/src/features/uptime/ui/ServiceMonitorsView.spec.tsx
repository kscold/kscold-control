import { render, screen } from '@testing-library/react';
import { useAuthStore } from '@/shared/model';
import { PERMISSIONS } from '@/shared/config/permissions';
import { uptimeService } from '../api/uptime.service';
import { ServiceMonitorsView } from './ServiceMonitorsView';

describe('ServiceMonitorsView', () => {
  beforeEach(() => {
    useAuthStore.setState({
      token: 't',
      user: {
        id: 'u',
        email: 'a@example.com',
        roles: ['admin'],
        permissions: [PERMISSIONS.SYSTEM_READ, PERMISSIONS.SYSTEM_WRITE],
      },
    } as never);
  });

  it('끊긴 곳 수와 주소별 가동률·응답 시간을 보여 준다', async () => {
    vi.spyOn(uptimeService, 'list').mockResolvedValue([
      {
        id: '1',
        name: '블로그',
        url: 'https://blog.example.com',
        intervalSeconds: 60,
        enabled: true,
        state: 'down',
        stateChangedAt: new Date().toISOString(),
        lastCheckedAt: new Date().toISOString(),
        uptime24hPercent: 98.5,
        averageLatencyMs: 120,
        lastError: 'HTTP 502',
        recent: [],
      },
    ]);
    render(<ServiceMonitorsView />);
    expect(await screen.findByText('1곳 중 1곳 끊김')).toBeInTheDocument();
    expect(screen.getByText('98.5%')).toBeInTheDocument();
    expect(screen.getByText('120ms')).toBeInTheDocument();
    expect(screen.getByText('마지막 실패: HTTP 502')).toBeInTheDocument();
  });
});
