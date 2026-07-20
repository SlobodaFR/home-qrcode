import { renderHook, act } from '@testing-library/react';
import { useCurrentUser } from './useCurrentUser';
import * as usersClient from '../../infrastructure/api/users.client';

afterEach(() => vi.restoreAllMocks());

describe('useCurrentUser', () => {
  // T45 — TPP: constant
  it('should fetch /api/auth/me on mount and return {name, avatarUrl, id}', async () => {
    const me = { id: 'u-1', name: 'Alice', email: 'a@b.com', avatarUrl: 'https://av.png' };
    vi.spyOn(usersClient, 'fetchCurrentUser').mockResolvedValue(me);
    const { result } = renderHook(() => useCurrentUser());
    expect(result.current).toBeNull();
    await act(async () => {});
    expect(usersClient.fetchCurrentUser).toHaveBeenCalled();
    expect(result.current).toMatchObject({ id: 'u-1', name: 'Alice', avatarUrl: 'https://av.png' });
  });
});
