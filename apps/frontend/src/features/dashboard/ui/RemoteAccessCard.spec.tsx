import { render, screen } from '@testing-library/react';
import { dashboardService } from '../api/dashboard.service';
import { RemoteAccessCard } from './RemoteAccessCard';

describe('RemoteAccessCard', () => {
  it('길마다 정상·끊김과 자세한 내용을 보여 준다', async () => {
    vi.spyOn(dashboardService, 'getRemoteAccess').mockResolvedValue([
      {
        id: 'tailscale',
        label: '테일스케일 SSH',
        state: 'ok',
        detail: '키 만료 2027-05-08',
      },
      {
        id: 'orca-relay',
        label: '폰 Orca 릴레이',
        state: 'down',
        detail: '데스크톱 앱이 꺼져 있음',
      },
    ]);

    render(<RemoteAccessCard />);

    expect(await screen.findByText('키 만료 2027-05-08')).toBeInTheDocument();
    expect(screen.getByText('데스크톱 앱이 꺼져 있음')).toBeInTheDocument();
    expect(screen.getByText('정상')).toBeInTheDocument();
    expect(screen.getByText('끊김')).toBeInTheDocument();
  });

  it('불러오지 못하면 그렇다고 알린다', async () => {
    vi.spyOn(dashboardService, 'getRemoteAccess').mockRejectedValue(
      new Error('x'),
    );
    render(<RemoteAccessCard />);
    expect(
      await screen.findByText('상태를 불러오지 못했습니다.'),
    ).toBeInTheDocument();
  });
});
