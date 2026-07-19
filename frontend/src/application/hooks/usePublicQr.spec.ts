import { renderHook, act } from '@testing-library/react';
import { usePublicQr } from './usePublicQr';
import { fetchQrMeta } from '../../infrastructure/api/qr.client';

vi.mock('../../infrastructure/api/qr.client');

const mockFetch = fetchQrMeta as ReturnType<typeof vi.fn>;

describe('usePublicQr', () => {
  afterEach(() => vi.clearAllMocks());

  // Test 10 — TPP: constant
  it('should start in loading state', () => {
    mockFetch.mockResolvedValue({ status: 200 });
    const { result } = renderHook(() => usePublicQr('qr-1'));
    expect(result.current.state).toBe('loading');
  });

  // Test 11 — TPP: conditional
  it('should transition to found when fetchQrMeta returns status 200', async () => {
    mockFetch.mockResolvedValue({ status: 200 });
    const { result } = renderHook(() => usePublicQr('qr-1'));
    await act(async () => {});
    expect(result.current.state).toBe('found');
  });

  // Test 12 — TPP: conditional
  it('should transition to notFound when fetchQrMeta returns status 404', async () => {
    mockFetch.mockResolvedValue({ status: 404 });
    const { result } = renderHook(() => usePublicQr('qr-1'));
    await act(async () => {});
    expect(result.current.state).toBe('notFound');
  });

  // Test 13 — TPP: conditional
  it('should transition to error when fetchQrMeta returns status error', async () => {
    mockFetch.mockResolvedValue({ status: 'error' });
    const { result } = renderHook(() => usePublicQr('qr-1'));
    await act(async () => {});
    expect(result.current.state).toBe('error');
  });

  // Test 14 — TPP: conditional
  it('should transition from found to error when onImageError is called', async () => {
    mockFetch.mockResolvedValue({ status: 200 });
    const { result } = renderHook(() => usePublicQr('qr-1'));
    await act(async () => {});
    expect(result.current.state).toBe('found');
    act(() => result.current.onImageError());
    expect(result.current.state).toBe('error');
  });
});
