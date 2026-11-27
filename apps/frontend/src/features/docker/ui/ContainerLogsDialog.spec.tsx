import { render, screen } from '@testing-library/react';
import { containerOpsService } from '../api/container-ops.service';
import { ContainerLogsDialog } from './ContainerLogsDialog';

describe('ContainerLogsDialog', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('열면 마지막 300줄 로그를 불러와 보여 준다', async () => {
    const spy = vi
      .spyOn(containerOpsService, 'getLogs')
      .mockResolvedValue('server started\n');
    render(
      <ContainerLogsDialog open dockerId="abc" name="web" onClose={() => {}} />,
    );
    expect(await screen.findByText(/server started/)).toBeInTheDocument();
    expect(spy).toHaveBeenCalledWith('abc', 300);
  });

  it('실패하면 오류를 보여 준다', async () => {
    vi.spyOn(containerOpsService, 'getLogs').mockRejectedValue(
      new Error('권한이 없습니다'),
    );
    render(
      <ContainerLogsDialog open dockerId="abc" name="web" onClose={() => {}} />,
    );
    expect(await screen.findByText('권한이 없습니다')).toBeInTheDocument();
  });
});
