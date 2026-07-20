import { createLink, listLinks, editLink, deleteLink, setLinkExpiration } from './links.client';
import type { ShortLinkItem } from './links.client';

const mockLink: ShortLinkItem = {
  id: 'sl-1', url: 'https://target.com', shortUrl: 'http://localhost:5173/r/sl-1',
  scanCount: 0, expiresAt: null, createdAt: '2026-01-01T00:00:00.000Z',
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

  // link-expiration: Test 44 — TPP: constant
  it('setLinkExpiration(id, expiresAt) should PATCH /api/links/:id/expiration with {expiresAt} body and credentials', async () => {
    const updated = { ...mockLink, expiresAt: '2026-08-25T23:59:59.000Z' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(updated) }));
    const result = await setLinkExpiration('sl-1', '2026-08-25T23:59:59.000Z');
    expect(fetch).toHaveBeenCalledWith('/api/links/sl-1/expiration', expect.objectContaining({
      method: 'PATCH',
      credentials: 'include',
      body: JSON.stringify({ expiresAt: '2026-08-25T23:59:59.000Z' }),
    }));
    expect(result.expiresAt).toBe('2026-08-25T23:59:59.000Z');
  });

  // link-expiration: Test 45 — TPP: variable
  it('createLink() should include expiresAt in POST body when provided', async () => {
    const withExpiry = { ...mockLink, expiresAt: '2026-08-25T23:59:59.000Z' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(withExpiry) }));
    await createLink('https://target.com', '2026-08-25T23:59:59.000Z');
    expect(fetch).toHaveBeenCalledWith('/api/links', expect.objectContaining({
      body: JSON.stringify({ url: 'https://target.com', expiresAt: '2026-08-25T23:59:59.000Z' }),
    }));
  });

  // link-expiration: Test 46 — TPP: variable
  it('ShortLinkItem returned from listLinks should include expiresAt field', async () => {
    const withExpiry = { ...mockLink, expiresAt: '2026-08-25T23:59:59.000Z' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ items: [withExpiry], total: 1, page: 1, limit: 20 }) }));
    const result = await listLinks();
    expect(result.items[0].expiresAt).toBe('2026-08-25T23:59:59.000Z');
  });
});
