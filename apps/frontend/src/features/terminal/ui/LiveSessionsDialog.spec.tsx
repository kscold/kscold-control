import { fireEvent, render, screen } from '@testing-library/react';
import { terminalSessionsService } from '../api/terminal-sessions.service';
import { LiveSessionsDialog } from './LiveSessionsDialog';

describe('LiveSessionsDialog', () => {
  it('살아 있는 세션을 보여 주고 고르면 알려 준다', async () => {
    vi.spyOn(terminalSessionsService, 'listLive').mockResolvedValue([
      { id: 'abcdef1234', title: '빌드', createdAt: '', lastActivityAt: null },
    ]);
    const onPick = vi.fn();
    render(
      <LiveSessionsDialog
        open
        openSessionIds={['abcdef1234']}
        onClose={() => {}}
        onPick={onPick}
      />,
    );
    fireEvent.click(await screen.findByText('빌드'));
    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'abcdef1234' }),
    );
    expect(screen.getByText('이 화면에 열림')).toBeInTheDocument();
  });
});
