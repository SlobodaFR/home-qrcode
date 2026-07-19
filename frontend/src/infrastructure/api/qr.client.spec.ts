import { fetchQrMeta } from './qr.client';

const mockFetch = (status: number, ok = status >= 200 && status < 300) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status, ok }));
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchQrMeta', () => {
  // Test 6 — TPP: constant
  it('should return { status: 200 } when fetch responds 200', async () => {
    mockFetch(200);
    const result = await fetchQrMeta('abc-123');
    expect(result).toEqual({ status: 200 });
    expect(fetch).toHaveBeenCalledWith('/api/qr/abc-123/meta');
  });

  // Test 7 — TPP: conditional
  it('should return { status: 404 } when fetch responds 404', async () => {
    mockFetch(404);
    const result = await fetchQrMeta('abc-123');
    expect(result).toEqual({ status: 404 });
  });

  // Test 8 — TPP: conditional
  it('should return { status: "error" } on 5xx response', async () => {
    mockFetch(500);
    const result = await fetchQrMeta('abc-123');
    expect(result).toEqual({ status: 'error' });
  });

  // Test 9 — TPP: conditional
  it('should return { status: "error" } on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    const result = await fetchQrMeta('abc-123');
    expect(result).toEqual({ status: 'error' });
  });
});
