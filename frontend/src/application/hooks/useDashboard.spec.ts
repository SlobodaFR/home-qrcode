import { renderHook, act } from '@testing-library/react';
import { useDashboard } from './useDashboard';
import * as client from '../../infrastructure/api/qr-auth.client';
import type { CreateQrPayload } from '../../infrastructure/api/qr-auth.client';

const makeItem = (overrides = {}) => ({
  id: 'qr-1', contentType: 'url' as const, content: 'https://example.com',
  scanCount: 0, createdAt: '2026-01-01T00:00:00.000Z',
  pngUrl: '/api/qr/qr-1/png', svgUrl: '/api/qr/qr-1/svg',
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
});
