import { fetchCurrentUser, listUsers } from './users.client';

afterEach(() => vi.restoreAllMocks());

const mockFetch = (body: unknown, ok = true) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok, json: () => Promise.resolve(body) }));
};

describe('listUsers', () => {
  // T43 — TPP: constant
  it('should GET /api/users with credentials and return UserItem[]', async () => {
    const users = [{ id: 'u-1', name: 'Alice', email: 'a@b.com', avatarUrl: '' }];
    mockFetch(users);
    const result = await listUsers();
    expect(fetch).toHaveBeenCalledWith('/api/users', expect.objectContaining({ credentials: 'include' }));
    expect(result).toEqual(users);
  });
});

describe('fetchCurrentUser', () => {
  // T44 — TPP: constant
  it('should GET /api/auth/me with credentials and return UserItem with avatarUrl', async () => {
    const me = { id: 'u-1', name: 'Alice', email: 'a@b.com', avatarUrl: 'https://av.png' };
    mockFetch(me);
    const result = await fetchCurrentUser();
    expect(fetch).toHaveBeenCalledWith('/api/auth/me', expect.objectContaining({ credentials: 'include' }));
    expect(result.avatarUrl).toBe('https://av.png');
  });
});
