import { attachLogo, createQrCode, setQrExpiration } from './qr-auth.client';
import type { CreateQrPayload } from './qr-auth.client';

const mockItem = {
  id: 'qr-1', contentType: 'wifi' as const, content: 'HomeNet',
  errorCorrection: 'M' as const,
  scanCount: 0, createdAt: '2026-01-01T00:00:00.000Z',
  pngUrl: '/api/qr/qr-1/png', svgUrl: '/api/qr/qr-1/svg',
  hasLogo: false, logoMimeType: null,
};

afterEach(() => vi.restoreAllMocks());

describe('createQrCode (extended-content-types)', () => {
  // Test 43 — TPP: constant
  it('should POST wifi payload as JSON body when createQrCode called with wifi type', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(mockItem) }));
    const payload: CreateQrPayload = { contentType: 'wifi', ssid: 'HomeNet', security: 'WPA', password: 'secret' };
    await createQrCode(payload);
    expect(fetch).toHaveBeenCalledWith('/api/qr', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(payload),
    }));
  });

  // Test 44 — TPP: variable
  it('should POST email payload with to, subject, body', async () => {
    const emailItem = { ...mockItem, contentType: 'email' as const };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(emailItem) }));
    const payload: CreateQrPayload = { contentType: 'email', to: 'user@example.com', subject: 'Hi', body: 'World' };
    await createQrCode(payload);
    expect(fetch).toHaveBeenCalledWith('/api/qr', expect.objectContaining({
      body: JSON.stringify(payload),
    }));
  });

  // Test 45 — TPP: variable
  it('should POST vcard payload with name and optional fields', async () => {
    const vcardItem = { ...mockItem, contentType: 'vcard' as const };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(vcardItem) }));
    const payload: CreateQrPayload = { contentType: 'vcard', name: 'Jane Doe', phone: '+33612345678' };
    await createQrCode(payload);
    expect(fetch).toHaveBeenCalledWith('/api/qr', expect.objectContaining({
      body: JSON.stringify(payload),
    }));
  });
});

describe('setQrExpiration (link-expiration)', () => {
  // Test 41 — TPP: constant
  it('setQrExpiration(id, expiresAt) should PATCH /api/qr/:id/expiration with {expiresAt} body and credentials', async () => {
    const updated = { ...mockItem, expiresAt: '2026-08-25T23:59:59.000Z' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(updated) }));
    const result = await setQrExpiration('qr-1', '2026-08-25T23:59:59.000Z');
    expect(fetch).toHaveBeenCalledWith('/api/qr/qr-1/expiration', expect.objectContaining({
      method: 'PATCH',
      credentials: 'include',
      body: JSON.stringify({ expiresAt: '2026-08-25T23:59:59.000Z' }),
    }));
    expect(result.expiresAt).toBe('2026-08-25T23:59:59.000Z');
  });

  // Test 42 — TPP: variable
  it('setQrExpiration(id, null) should send {expiresAt: null} in body', async () => {
    const updated = { ...mockItem, expiresAt: null };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(updated) }));
    await setQrExpiration('qr-1', null);
    expect(fetch).toHaveBeenCalledWith('/api/qr/qr-1/expiration', expect.objectContaining({
      body: JSON.stringify({ expiresAt: null }),
    }));
  });

  // Test 43 — TPP: variable
  it('QrItem returned from createQrCode should include expiresAt field from API response', async () => {
    const withExpiry = { ...mockItem, expiresAt: '2026-08-25T23:59:59.000Z' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(withExpiry) }));
    const result = await createQrCode({ contentType: 'text', content: 'hello' });
    expect(result.expiresAt).toBe('2026-08-25T23:59:59.000Z');
  });
});

describe('attachLogo (logo-overlay)', () => {
  // Test 27 — TPP: constant
  it('should POST FormData with logo file to /api/qr/:id/logo and return updated QrItem', async () => {
    const logoItem = { ...mockItem, hasLogo: true, logoMimeType: 'image/png' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(logoItem) }));
    const file = new File(['logo'], 'logo.png', { type: 'image/png' });
    const result = await attachLogo('qr-1', file);
    const [url, opts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/api/qr/qr-1/logo');
    expect(opts.method).toBe('POST');
    expect(opts.body).toBeInstanceOf(FormData);
    expect(result.hasLogo).toBe(true);
    expect(result.logoMimeType).toBe('image/png');
  });
});
