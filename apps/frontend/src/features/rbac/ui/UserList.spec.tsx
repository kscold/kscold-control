import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User } from '@/entities/user';
import { UserList } from './UserList';

describe('UserList QA preview', () => {
  const keyManager = {
    id: 'target-user',
    email: 'developer@example.com',
    roles: [{ id: 'key-manager', name: 'key_manager' }],
    terminalCommandCount: 0,
    terminalCommandLimit: 0,
  } as User;
  const administrator = {
    id: 'admin-user',
    email: 'admin@example.com',
    roles: [{ id: 'admin', name: 'admin' }],
    terminalCommandCount: 0,
    terminalCommandLimit: -1,
  } as User;

  function renderList(onPreviewUser = vi.fn()) {
    render(
      <UserList
        users={[administrator, keyManager]}
        onAssignRoles={vi.fn()}
        onUpdatePassword={vi.fn().mockResolvedValue(true)}
        onDelete={vi.fn()}
        onResetTerminalLimit={vi.fn()}
        onUpdateTerminalLimit={vi.fn().mockResolvedValue(true)}
        onCreateUser={vi.fn()}
        onApproveKeyManager={vi.fn().mockResolvedValue(true)}
        onPreviewUser={onPreviewUser}
      />,
    );
    return onPreviewUser;
  }

  it('일반 사용자에게만 QA 화면 보기 버튼을 표시한다', () => {
    renderList();

    expect(
      screen.getAllByRole('button', { name: /QA 화면 보기/ }),
    ).toHaveLength(1);
  });

  it('QA 화면 보기 클릭 시 대상 사용자를 전달한다', async () => {
    const onPreviewUser = renderList();

    await userEvent.click(screen.getByRole('button', { name: /QA 화면 보기/ }));

    expect(onPreviewUser).toHaveBeenCalledWith(keyManager);
  });
});
