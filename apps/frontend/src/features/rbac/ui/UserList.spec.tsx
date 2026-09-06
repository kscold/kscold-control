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

  function renderList(
    onPreviewUser = vi.fn(),
    onUpdateKeyManagementTargets = vi.fn().mockResolvedValue(true),
  ) {
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
        keyManagementTargets={[
          {
            id: 'gole-production',
            displayName: 'GoLe Production',
            environment: 'production',
          },
          {
            id: 'pawpong-production',
            displayName: 'Pawpong Production',
            environment: 'production',
          },
        ]}
        keyManagementAssignments={{
          [keyManager.id]: ['gole-production'],
        }}
        onUpdateKeyManagementTargets={onUpdateKeyManagementTargets}
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

  it('키 관리자의 허용 대상과 관리자의 전체 접근을 구분해 표시한다', () => {
    renderList();

    expect(screen.getByText('관리자 전체 접근')).toBeInTheDocument();
    expect(screen.getAllByText('GoLe Production')).toHaveLength(2);
    expect(screen.getAllByText('Pawpong Production')).toHaveLength(1);
  });

  it('키 관리자의 Pawpong 범위를 체크해 저장한다', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn().mockResolvedValue(true);
    renderList(vi.fn(), onUpdate);

    await user.click(screen.getByRole('button', { name: '범위 변경' }));
    await user.click(
      screen.getByRole('checkbox', { name: /Pawpong Production/ }),
    );
    await user.click(screen.getByRole('button', { name: '범위 저장' }));

    expect(onUpdate).toHaveBeenCalledWith('target-user', [
      'gole-production',
      'pawpong-production',
    ]);
  });
});
