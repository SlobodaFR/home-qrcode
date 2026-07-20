import { createLink, listLinks, editLink, deleteLink } from './links.client';
import type { ShortLinkItem } from './links.client';

const mockLink: ShortLinkItem = {
  id: 'sl-1', url: 'https://target.com', shortUrl: 'http://localhost:5173/r/sl-1',
  scanCount: 0, createdAt: '2026-01-01T00:00:00.000Z',
};

afterEach(() => vi.restoreAllMocks());

describe('links.client', () => {
  // url-shortener: Test 37 — TPP: constant
  it('createLink() should POST to /api/links with {url} body and return ShortLinkItem', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(mockLink) }));
    const result = await createLink('https://target.com');
    expect(fetch).toHaveBeenCalledWith('/api/links', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ url: 'https://target.com' }),
    }));
    expect(result.id).toBe('sl-1');
  });

  // url-shortener: Test 38 — TPP: variable
  it('listLinks() should GET /api/links with page and limit as query params', async () => {
    const mockList = { items: [mockLink], total: 1, page: 1, limit: 20 };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(mockList) }));
    const result = await listLinks(2, 10);
    expect(fetch).toHaveBeenCalledWith('/api/links?page=2&limit=10', expect.objectContaining({ credentials: 'include' }));
    expect(result.items).toHaveLength(1);
  });

  // url-shortener: Test 39 — TPP: variable
  it('editLink() should PATCH /api/links/:id with {url} body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(mockLink) }));
    await editLink('sl-1', 'https://new.com');
    expect(fetch).toHaveBeenCalledWith('/api/links/sl-1', expect.objectContaining({
      method: 'PATCH',
      credentials: 'include',
      body: JSON.stringify({ url: 'https://new.com' }),
    }));
  });

  // url-shortener: Test 40 — TPP: constant
  it('deleteLink() should DELETE /api/links/:id with credentials', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    await deleteLink('sl-1');
    expect(fetch).toHaveBeenCalledWith('/api/links/sl-1', expect.objectContaining({
      method: 'DELETE',
      credentials: 'include',
    }));
  });

  // url-shortener: Test 41 — TPP: conditional
  it('createLink() should throw Error when response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400 }));
    await expect(createLink('https://target.com')).rejects.toThrow('createLink failed: 400');
  });
});
