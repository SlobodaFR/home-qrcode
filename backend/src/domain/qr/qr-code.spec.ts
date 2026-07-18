import { QrCode, QrCodeProps } from './qr-code';

const validProps: QrCodeProps = {
  id: 'abc-123',
  userId: 'user-1',
  contentType: 'url',
  content: 'https://example.com',
  size: 1024,
  fgColor: '#000000',
  bgColor: '#FFFFFF',
  errorCorrection: 'M',
  createdAt: new Date('2026-01-01'),
};

describe('QrCode', () => {
  // Test 1 — TPP: constant
  it('should create a QrCode with all valid props and expose them via getters', () => {
    const qr = QrCode.create(validProps);
    expect(qr.id).toBe('abc-123');
    expect(qr.userId).toBe('user-1');
    expect(qr.contentType).toBe('url');
    expect(qr.content).toBe('https://example.com');
    expect(qr.size).toBe(1024);
    expect(qr.fgColor).toBe('#000000');
    expect(qr.bgColor).toBe('#FFFFFF');
    expect(qr.errorCorrection).toBe('M');
    expect(qr.createdAt).toEqual(new Date('2026-01-01'));
  });

  // Test 2 — TPP: variable
  it('should expose pngUrl and svgUrl as computed paths based on id', () => {
    const qr = QrCode.create(validProps);
    expect(qr.pngUrl).toBe('/api/qr/abc-123/png');
    expect(qr.svgUrl).toBe('/api/qr/abc-123/svg');
  });
});
