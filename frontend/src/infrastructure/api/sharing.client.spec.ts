import { listSharedWithMe, shareQr, unshareQr } from './sharing.client';

afterEach(() => vi.restoreAllMocks());

const mockFetch = (body: unknown, ok = true) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok, json: () => Promise.resolve(body) }));
};

describe('shareQr', () => {
  // T40 — TPP: constant
  it('should POST to /api/qr/:id/shares with {recipientId} and credentials and return parsed share', async () => {
    const share = { shareId: 'share-1', recipientId: 'user-2', createdAt: '2026-01-01T00:00:00.000Z' };
    mockFetch(share);
    const result = await shareQr('qr-1', 'user-2');
    expect(fetch).toHaveBeenCalledWith('/api/qr/qr-1/shares', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ recipientId: 'user-2' }),
    }));
    expect(result).toEqual(share);
  });

  it('should throw when response is not ok', async () => {
    mockFetch({}, false);
    await expect(shareQr('qr-1', 'user-2')).rejects.toThrow();
  });
});

describe('unshareQr', () => {
  // T41 — TPP: constant
  it('should DELETE /api/qr/:id/shares/:shareId with credentials', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    await unshareQr('qr-1', 'share-1');
    expect(fetch).toHaveBeenCalledWith('/api/qr/qr-1/shares/share-1', expect.objectContaining({
      method: 'DELETE',
      credentials: 'include',
    }));
  });

  it('should throw when response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    await expect(unshareQr('qr-1', 'share-1')).rejects.toThrow();
  });
});

describe('listSharedWithMe', () => {
  // T42 — TPP: constant
  it('should GET /api/qr/shared-with-me with credentials and return SharedQrItem[]', async () => {
    const items = [{ id: 'qr-1', sharedBy: { id: 'user-1', name: 'Alice' } }];
    mockFetch(items);
    const result = await listSharedWithMe();
    expect(fetch).toHaveBeenCalledWith('/api/qr/shared-with-me', expect.objectContaining({
      credentials: 'include',
    }));
    expect(result).toEqual(items);
  });
});
