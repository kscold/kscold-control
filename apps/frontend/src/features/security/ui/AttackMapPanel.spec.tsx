import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { securityService } from '../api/security.service';
import type { AttackMapView, AttackPoint } from '../model/security.types';
import AttackMapPanel from './AttackMapPanel';

afterEach(() => vi.restoreAllMocks());

const point = (
  ip: string,
  country: string | null,
  attempts: number,
  blocked: boolean,
): AttackPoint => ({
  ip,
  geo: country
    ? {
        country,
        countryName: country === 'NL' ? '네덜란드' : '미국',
        city: country === 'NL' ? '암스테르담' : null,
        lat: 50,
        lon: 5,
      }
    : null,
  ssh: { failures: attempts, successes: 0 },
  web: { failures: 0 },
  attempts,
  blocked,
  lastAt: '2026-11-11 09:00:00',
});

const enabled: AttackMapView = {
  enabled: true,
  builtAt: '2026-11-01T00:00:00.000Z',
  since: '2026-11-04 09:00:00',
  points: [
    point('203.0.113.7', 'NL', 40, true),
    point('203.0.113.8', 'NL', 10, false),
    point('198.51.100.9', 'US', 5, false),
    point('192.0.2.77', null, 1, false),
  ],
  countries: [
    {
      country: 'NL',
      countryName: '네덜란드',
      attempts: 50,
      ips: 2,
      blockedIps: 1,
    },
    { country: 'US', countryName: '미국', attempts: 5, ips: 1, blockedIps: 0 },
    { country: null, countryName: null, attempts: 1, ips: 1, blockedIps: 0 },
  ],
};

it('IP 위치 파일이 없으면 설정 방법을 알려 준다', async () => {
  vi.spyOn(securityService, 'getAttackMap').mockResolvedValue({
    enabled: false,
    reason: 'off',
  });
  render(<AttackMapPanel />);

  expect(
    await screen.findByText(/CONTROL_IP_GEO_DB_PATH 에 경로를 넣고/),
  ).toBeInTheDocument();
  expect(screen.getByText(/fetch-ip-geo-db\.mjs/)).toBeInTheDocument();
});

it('나라별 순위를 보여 주고 나라를 누르면 그 나라 IP 만 남긴다', async () => {
  const get = vi
    .spyOn(securityService, 'getAttackMap')
    .mockResolvedValue(enabled);
  render(<AttackMapPanel />);

  const nl = await screen.findByRole('button', {
    name: /^네덜란드 시도 50회, IP 2개, 차단 50%$/,
  });
  expect(
    screen.getByRole('button', { name: /^위치 모름 시도 1회/ }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('img', { name: /네덜란드 50회/ }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'IP Geolocation by DB-IP' }),
  ).toHaveAttribute('href', 'https://db-ip.com');
  expect(screen.getByText('198.51.100.9')).toBeInTheDocument();

  await userEvent.click(nl);
  expect(nl).toHaveAttribute('aria-pressed', 'true');
  expect(screen.queryByText('198.51.100.9')).toBeNull();
  const kept = screen.getByText('203.0.113.7').closest('div')!.parentElement!;
  expect(within(kept).getByText('네덜란드 암스테르담')).toBeInTheDocument();
  expect(within(kept).getByText('차단 중')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: /만 보는 중/ }));
  expect(screen.getByText('198.51.100.9')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: '30일' }));
  expect(get).toHaveBeenLastCalledWith(30, expect.any(AbortSignal));
});
