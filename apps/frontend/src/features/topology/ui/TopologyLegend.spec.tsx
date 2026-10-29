import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TopologyLegend } from './TopologyLegend';

describe('TopologyLegend', () => {
  it('배치를 바꿀 수 있으면 자동 정렬 버튼으로 기본 배치 되돌리기를 요청한다', async () => {
    const user = userEvent.setup();
    const onResetLayout = vi.fn();
    render(
      <TopologyLegend
        loading={false}
        onRefresh={vi.fn()}
        generatedAt={null}
        onResetLayout={onResetLayout}
      />,
    );

    await user.click(screen.getByRole('button', { name: '자동 정렬' }));

    expect(onResetLayout).toHaveBeenCalledTimes(1);
  });

  it('배치 변경 권한이 없으면 자동 정렬 버튼을 보여주지 않는다', () => {
    render(
      <TopologyLegend loading={false} onRefresh={vi.fn()} generatedAt={null} />,
    );

    expect(
      screen.queryByRole('button', { name: '자동 정렬' }),
    ).not.toBeInTheDocument();
  });
});
