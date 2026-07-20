import { renderHook, act } from '@testing-library/react';
import { useDashboard } from './useDashboard';
import * as client from '../../infrastructure/api/qr-auth.client';
import type { CreateQrPayload } from '../../infrastructure/api/qr-auth.client';


const makeItem = (overrides = {}) => ({
  id: 'qr-1', contentType: 'url' as const, content: 'https://example.com',
  errorCorrection: 'M' as const,
  scanCount: 0, expiresAt: null as string | null, createdAt: '2026-01-01T00:00:00.000Z',
  pngUrl: '/api/qr/qr-1/png', svgUrl: '/api/qr/qr-1/svg',
  hasLogo: false, logoMimeType: null as string | null,
  ...overrides,
});

afterEach(() => vi.restoreAllMocks());

describe('useDashboard', () => {
  it('should load items on mount', async () => {
    vi.spyOn(client, 'listQrCodes').mockResolvedValue({ items: [makeItem()], total: 1, page: 1, limit: 20 });
    const { result } = renderHook(() => useDashboard());
    await act(async () => {});
    expect(result.current.items).toHaveLength(1);
    expect(result.current.total).toBe(1);
  });

  // Test 46 — TPP: conditional
  it('should accept CreateQrPayload and prepend result to items on create', async () => {
    vi.spyOn(client, 'listQrCodes').mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });
    const wifiItem = makeItem({ id: 'qr-wifi', contentType: 'wifi' as const, content: 'HomeNet' });
    vi.spyOn(client, 'createQrCode').mockResolvedValue(wifiItem);

    const { result } = renderHook(() => useDashboard());
    await act(async () => {});

    const payload: CreateQrPayload = { contentType: 'wifi', ssid: 'HomeNet', security: 'WPA', password: 'secret' };
    await act(async () => { await result.current.create(payload); });

    expect(client.createQrCode).toHaveBeenCalledWith(payload);
    expect(result.current.items[0].id).toBe('qr-wifi');
    expect(result.current.total).toBe(1);
  });

  // Test 28 — TPP: variable
  it('should call attachLogo client function and update item in list with hasLogo=true', async () => {
    const item = makeItem({ id: 'qr-logo', hasLogo: false });
    vi.spyOn(client, 'listQrCodes').mockResolvedValue({ items: [item], total: 1, page: 1, limit: 20 });
    const updatedItem = makeItem({ id: 'qr-logo', hasLogo: true, logoMimeType: 'image/png' });
    vi.spyOn(client, 'attachLogo').mockResolvedValue(updatedItem);

    const { result } = renderHook(() => useDashboard());
    await act(async () => {});

    const file = new File(['logo'], 'logo.png', { type: 'image/png' });
    await act(async () => { await result.current.attachLogo('qr-logo', file); });

    expect(client.attachLogo).toHaveBeenCalledWith('qr-logo', file);
    expect(result.current.items.find((q) => q.id === 'qr-logo')?.hasLogo).toBe(true);
  });

  // link-expiration: Test 47 — TPP: variable
  it('setExpiration(id, dateString) should call setQrExpiration and replace matching item in state', async () => {
    const item = makeItem({ id: 'qr-1', expiresAt: null });
    vi.spyOn(client, 'listQrCodes').mockResolvedValue({ items: [item], total: 1, page: 1, limit: 20 });
    const updated = makeItem({ id: 'qr-1', expiresAt: '2026-08-25T23:59:59.000Z' });
    vi.spyOn(client, 'setQrExpiration').mockResolvedValue(updated);

    const { result } = renderHook(() => useDashboard());
    await act(async () => {});

    await act(async () => { await result.current.setExpiration('qr-1', '2026-08-25T23:59:59.000Z'); });

    expect(client.setQrExpiration).toHaveBeenCalledWith('qr-1', '2026-08-25T23:59:59.000Z');
    expect(result.current.items.find((q) => q.id === 'qr-1')?.expiresAt).toBe('2026-08-25T23:59:59.000Z');
  });

  // link-expiration: Test 48 — TPP: conditional
  it('setExpiration(id, null) should call setQrExpiration with null and clear expiresAt in state', async () => {
    const item = makeItem({ id: 'qr-1', expiresAt: '2026-08-25T23:59:59.000Z' });
    vi.spyOn(client, 'listQrCodes').mockResolvedValue({ items: [item], total: 1, page: 1, limit: 20 });
    const updated = makeItem({ id: 'qr-1', expiresAt: null });
    vi.spyOn(client, 'setQrExpiration').mockResolvedValue(updated);

    const { result } = renderHook(() => useDashboard());
    await act(async () => {});

    await act(async () => { await result.current.setExpiration('qr-1', null); });

    expect(client.setQrExpiration).toHaveBeenCalledWith('qr-1', null);
    expect(result.current.items.find((q) => q.id === 'qr-1')?.expiresAt).toBeNull();
  });
});
