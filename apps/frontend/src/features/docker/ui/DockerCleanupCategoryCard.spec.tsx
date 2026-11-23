import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DockerCleanupCategoryCard } from './DockerCleanupCategoryCard';

describe('DockerCleanupCategoryCard', () => {
  it('액션 가능한 카테고리 버튼을 렌더링한다', async () => {
    const user = userEvent.setup();
    const onPreview = vi.fn();
    const onExecute = vi.fn();

    render(
      <DockerCleanupCategoryCard
        title="Dangling 이미지"
        description="설명"
        actionKey="images"
        category={{
          items: [
            {
              id: 'img-1',
              label: '<none>:<none>',
              detail: '0 containers',
              size: 1024,
              reclaimable: 1024,
            },
          ],
          totalBytes: 1024,
          reclaimableBytes: 1024,
        }}
        onPreview={onPreview}
        onExecute={onExecute}
      />,
    );

    await user.click(screen.getByRole('button', { name: '예상 절감량 보기' }));
    await user.click(screen.getByRole('button', { name: '안전 정리 실행' }));

    expect(onPreview).toHaveBeenCalledWith('images');
    expect(onExecute).toHaveBeenCalledWith('images');
  });

  it('보기 전용 카테고리는 액션 버튼을 숨긴다', () => {
    render(
      <DockerCleanupCategoryCard
        title="배포 부산물"
        description="설명"
        category={{
          items: [],
          totalBytes: 0,
          reclaimableBytes: 0,
        }}
      />,
    );

    expect(screen.getByText('보기 전용')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '예상 절감량 보기' }),
    ).not.toBeInTheDocument();
  });

  it('꺼진 컨테이너는 고른 것만 지우도록 넘긴다', async () => {
    const user = userEvent.setup();
    const onExecute = vi.fn();
    render(
      <DockerCleanupCategoryCard
        title="종료된 컨테이너"
        description="설명"
        actionKey="containers"
        selectable
        category={{
          items: [
            { id: 'c1', label: 'old-job', size: 10 },
            { id: 'c2', label: 'congbang', size: 20 },
          ],
          totalBytes: 30,
          reclaimableBytes: 30,
        }}
        onExecute={onExecute}
      />,
    );

    const run = screen.getByRole('button', { name: '고른 0개 지우기' });
    expect(run).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: 'old-job 고르기' }));
    await user.click(screen.getByRole('button', { name: '고른 1개 지우기' }));
    expect(onExecute).toHaveBeenCalledWith('containers', [
      { id: 'c1', label: 'old-job' },
    ]);
  });
});
