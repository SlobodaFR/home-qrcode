import { renderHook, act } from '@testing-library/react';
import { useSharedWithMe } from './useSharedWithMe';
import * as sharingClient from '../../infrastructure/api/sharing.client';

afterEach(() => vi.restoreAllMocks());

const mockItem = {
  id: 'qr-1', content: 'https://x.com', pngUrl: '/png', svgUrl: '/svg',
  hasLogo: false, expiresAt: null, sharedBy: { id: 'u-1', name: 'Alice' },
};

describe('useSharedWithMe', () => {
  // T46 — TPP: constant
  it('should be in loading state initially and call listSharedWithMe on mount', async () => {
    vi.spyOn(sharingClient, 'listSharedWithMe').mockResolvedValue([mockItem]);
    const { result } = renderHook(() => useSharedWithMe());
    expect(result.current.state).toBe('loading');
    expect(result.current.items).toEqual([]);
    await act(async () => {});
    expect(sharingClient.listSharedWithMe).toHaveBeenCalled();
  });

  // T47 — TPP: variable
  it('should transition to ready state with items after successful fetch', async () => {
    vi.spyOn(sharingClient, 'listSharedWithMe').mockResolvedValue([mockItem]);
    const { result } = renderHook(() => useSharedWithMe());
    await act(async () => {});
    expect(result.current.state).toBe('ready');
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toMatchObject({ id: 'qr-1', sharedBy: { name: 'Alice' } });
  });
});
