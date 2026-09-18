import axios, {
  AxiosError,
  AxiosHeaders,
  type InternalAxiosRequestConfig,
} from 'axios';
import { api } from './client';
import { useAuthStore } from '../model/auth.store';

describe('API authentication recovery', () => {
  beforeEach(() => {
    useAuthStore.setState({
      token: 'current',
      user: null,
      impersonation: null,
    });
  });
  afterEach(() => vi.restoreAllMocks());

  function unauthorized(config: InternalAxiosRequestConfig) {
    return new AxiosError(
      'Unauthorized',
      'ERR_BAD_REQUEST',
      config,
      undefined,
      {
        status: 401,
        statusText: 'Unauthorized',
        data: {},
        headers: new AxiosHeaders(),
        config,
      },
    );
  }

  it('revalidates and retries a rejected upload once without losing the login', async () => {
    vi.spyOn(axios, 'get').mockResolvedValue({ data: {} });
    let calls = 0;
    const result = await api.post('/repository/upload', 'payload', {
      adapter: async (config) => {
        if (++calls === 1) throw unauthorized(config);
        return {
          status: 201,
          statusText: 'Created',
          data: 'saved',
          headers: new AxiosHeaders(),
          config,
        };
      },
    });
    expect(result.data).toBe('saved');
    expect(calls).toBe(2);
    expect(useAuthStore.getState().token).toBe('current');
  });

  it('does not loop or log out when the endpoint keeps rejecting a valid session', async () => {
    vi.spyOn(axios, 'get').mockResolvedValue({ data: {} });
    let calls = 0;
    await expect(
      api.get('/repository/upload', {
        adapter: async (config) => {
          calls++;
          throw unauthorized(config);
        },
      }),
    ).rejects.toBeInstanceOf(AxiosError);
    expect(calls).toBe(2);
    expect(useAuthStore.getState().token).toBe('current');
  });

  it('preserves a newer login when an old request fails', async () => {
    const check = vi.spyOn(axios, 'get');
    await expect(
      api.get('/repository/upload', {
        adapter: async (config) => {
          useAuthStore.setState({ token: 'new-login' });
          throw unauthorized(config);
        },
      }),
    ).rejects.toBeInstanceOf(AxiosError);
    expect(check).not.toHaveBeenCalled();
    expect(useAuthStore.getState().token).toBe('new-login');
  });

  it('preserves the session if authentication recheck has a network failure', async () => {
    vi.spyOn(axios, 'get').mockRejectedValue(new AxiosError('Network Error'));
    await expect(
      api.get('/repository/upload', {
        adapter: async (config) => {
          throw unauthorized(config);
        },
      }),
    ).rejects.toBeInstanceOf(AxiosError);
    expect(useAuthStore.getState().token).toBe('current');
  });
});
