import { fireEvent, render, screen } from '@testing-library/react';
import type { SshAccessOverview } from '../model/security.types';
import { CurrentIpBanner } from './CurrentIpBanner';

const base = (over: Partial<SshAccessOverview>) =>
  ({
    knownIps: [],
    blocks: [],
    requesterIp: '203.0.113.7',
    ...over,
  }) as SshAccessOverview;

describe('CurrentIpBanner', () => {
  it('막힌 내 주소는 차단됨으로 보이고 바로 풀 수 있다', () => {
    const onUnblock = vi.fn();
    render(
      <CurrentIpBanner
        data={base({ blocks: [{ ip: '203.0.113.7' }] as never })}
        canManage
        onAddKnown={() => {}}
        onUnblock={onUnblock}
      />,
    );
    expect(screen.getByText('차단됨')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /차단 해제/ }));
    expect(onUnblock).toHaveBeenCalledWith('203.0.113.7');
  });

  it('등록된 내 IP 면 등록 버튼을 숨긴다', () => {
    render(
      <CurrentIpBanner
        data={base({ knownIps: [{ ip: '203.0.113.7' }] as never })}
        canManage
        onAddKnown={() => {}}
        onUnblock={() => {}}
      />,
    );
    expect(screen.getByText('내 IP')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /내 IP 로 등록/ })).toBeNull();
  });

  it('내부 주소면 등록 버튼 없이 막히지 않는다고 알린다', () => {
    render(
      <CurrentIpBanner
        data={base({ requesterIp: '127.0.0.1' })}
        canManage
        onAddKnown={() => {}}
        onUnblock={() => {}}
      />,
    );
    expect(screen.getByText('내부 주소 · 막히지 않음')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /내 IP 로 등록/ })).toBeNull();
  });
});
