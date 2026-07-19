import { render, screen } from '@testing-library/react';
import { PublicQrPage } from './PublicQrPage';
import { usePublicQr } from '../../application/hooks/usePublicQr';

vi.mock('../../application/hooks/usePublicQr');
vi.mock('react-router-dom', () => ({ useParams: () => ({ id: 'qr-test-id' }) }));

const mockHook = usePublicQr as ReturnType<typeof vi.fn>;
const noop = () => {};

describe('PublicQrPage', () => {
  afterEach(() => vi.clearAllMocks());

  // Test 16 — TPP: constant
  it('should show loading indicator while state is loading', () => {
    mockHook.mockReturnValue({ state: 'loading', onImageError: noop });
    render(<PublicQrPage />);
    expect(screen.getByRole('status')).toBeTruthy();
  });

  // Test 17 — TPP: constant
  it('should show QR image with src /api/qr/:id/png when state is found', () => {
    mockHook.mockReturnValue({ state: 'found', onImageError: noop });
    render(<PublicQrPage />);
    const img = screen.getByRole('img') as HTMLImageElement;
    expect(img.src).toContain('/api/qr/qr-test-id/png');
  });

  // Test 18 — TPP: variable
  it('should show Download PNG anchor with correct href and download attribute when found', () => {
    mockHook.mockReturnValue({ state: 'found', onImageError: noop });
    render(<PublicQrPage />);
    const link = screen.getByRole('link', { name: /download png/i }) as HTMLAnchorElement;
    expect(link.href).toContain('/api/qr/qr-test-id/png');
    expect(link.download).toBe('qr-qr-test-id.png');
  });

  // Test 19 — TPP: variable
  it('should show Download SVG anchor with correct href and download attribute when found', () => {
    mockHook.mockReturnValue({ state: 'found', onImageError: noop });
    render(<PublicQrPage />);
    const link = screen.getByRole('link', { name: /download svg/i }) as HTMLAnchorElement;
    expect(link.href).toContain('/api/qr/qr-test-id/svg');
    expect(link.download).toBe('qr-qr-test-id.svg');
  });

  // Test 20 — TPP: variable
  it('should wire onImageError from hook to img element', () => {
    const onImageError = vi.fn();
    mockHook.mockReturnValue({ state: 'found', onImageError });
    const { container } = render(<PublicQrPage />);
    const img = container.querySelector('img') as HTMLImageElement;
    img.dispatchEvent(new Event('error'));
    expect(onImageError).toHaveBeenCalled();
  });

  // Test 21 — TPP: conditional
  it('should show 404 view when state is notFound', () => {
    mockHook.mockReturnValue({ state: 'notFound', onImageError: noop });
    render(<PublicQrPage />);
    expect(screen.getByText(/404/i)).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  // Test 22 — TPP: conditional
  it('should show generic error view when state is error', () => {
    mockHook.mockReturnValue({ state: 'error', onImageError: noop });
    render(<PublicQrPage />);
    expect(screen.getByText(/unavailable/i)).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  // Test 23 — TPP: variable
  it('document title should contain "QR Code"', () => {
    mockHook.mockReturnValue({ state: 'found', onImageError: noop });
    render(<PublicQrPage />);
    expect(document.title).toMatch(/QR Code/i);
  });
});
