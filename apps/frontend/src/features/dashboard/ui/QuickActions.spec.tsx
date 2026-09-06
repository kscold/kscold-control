import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PERMISSIONS } from '@/shared/config/permissions';
import { useAuthStore } from '@/shared/model';
import { QuickActions } from './QuickActions';

describe('QuickActions', () => {
  beforeEach(() => {
    useAuthStore.setState({
      token: 'test-token',
      user: {
        id: 'key-manager-user',
        email: 'developer@example.com',
        roles: ['key_manager'],
        permissions: [
          PERMISSIONS.DASHBOARD_READ,
          PERMISSIONS.SECRETS_READ,
          PERMISSIONS.SECRETS_REVEAL,
          PERMISSIONS.SECRETS_WRITE,
          PERMISSIONS.SECRETS_DEPLOY,
        ],
      },
      isValidating: false,
    });
  });

  it('키 관리자에게 허용된 운영 키 액션만 보여준다', () => {
    render(
      <MemoryRouter>
        <QuickActions />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('button', { name: /운영 키 관리/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Terminal/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Docker Manager/ }),
    ).not.toBeInTheDocument();
  });
});
