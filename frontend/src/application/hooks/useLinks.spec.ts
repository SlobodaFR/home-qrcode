import { act, renderHook } from '@testing-library/react';
import * as linksClient from '../../infrastructure/api/links.client';
import type { ShortLinkItem } from '../../infrastructure/api/links.client';
import { useLinks } from './useLinks';

const mockLink: ShortLinkItem = {
  id: 'sl-1', url: 'https://target.com', shortUrl: 'http://localhost:5173/r/sl-1',
  scanCount: 0, createdAt: '2026-01-01T00:00:00.000Z',
};

afterEach(() => vi.restoreAllMocks());

describe('useLinks', () => {
  // url-shortener: Test 42 — TPP: constant
  it('should be in loading state initially', () => {
    vi.spyOn(linksClient, 'listLinks').mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });
    const { result } = renderHook(() => useLinks());
    expect(result.current.state).toBe('loading');
  });

  // url-shortener: Test 43 — TPP: variable
  it('should transition to ready and set items after listLinks resolves', async () => {
    vi.spyOn(linksClient, 'listLinks').mockResolvedValue({ items: [mockLink], total: 1, page: 1, limit: 20 });
    const { result } = renderHook(() => useLinks());
    await act(async () => {});
    expect(result.current.state).toBe('ready');
    expect(result.current.items).toHaveLength(1);
    expect(result.current.total).toBe(1);
  });

  // url-shortener: Test 44 — TPP: conditional
  it('should set state to error when listLinks rejects', async () => {
    vi.spyOn(linksClient, 'listLinks').mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useLinks());
    await act(async () => {});
    expect(result.current.state).toBe('error');
  });

  // url-shortener: Test 45 — TPP: variable
  it('create() should prepend new link to items and increment total', async () => {
    vi.spyOn(linksClient, 'listLinks').mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });
    vi.spyOn(linksClient, 'createLink').mockResolvedValue(mockLink);
    const { result } = renderHook(() => useLinks());
    await act(async () => {});
    await act(async () => { await result.current.create('https://target.com'); });
    expect(result.current.items[0].id).toBe('sl-1');
    expect(result.current.total).toBe(1);
  });

  // url-shortener: Test 46 — TPP: conditional
  it('remove() should filter out deleted link and decrement total', async () => {
    vi.spyOn(linksClient, 'listLinks').mockResolvedValue({ items: [mockLink], total: 1, page: 1, limit: 20 });
    vi.spyOn(linksClient, 'deleteLink').mockResolvedValue(undefined);
    const { result } = renderHook(() => useLinks());
    await act(async () => {});
    await act(async () => { await result.current.remove('sl-1'); });
    expect(result.current.items).toHaveLength(0);
    expect(result.current.total).toBe(0);
  });

  // url-shortener: Test 47 — TPP: conditional
  it('edit() should replace edited item in items list', async () => {
    vi.spyOn(linksClient, 'listLinks').mockResolvedValue({ items: [mockLink], total: 1, page: 1, limit: 20 });
    const updated = { ...mockLink, url: 'https://new.com' };
    vi.spyOn(linksClient, 'editLink').mockResolvedValue(updated);
    const { result } = renderHook(() => useLinks());
    await act(async () => {});
    await act(async () => { await result.current.edit('sl-1', 'https://new.com'); });
    expect(result.current.items[0].url).toBe('https://new.com');
  });
});
