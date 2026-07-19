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

  // Test N+1 — TPP: constant
  it('should have scanCount getter returning the value from props', () => {
    const qr = QrCode.create({ ...validProps, scanCount: 7 });
    expect(qr.scanCount).toBe(7);
  });

  // Test N+2 — TPP: constant
  it('should default scanCount to 0 when not provided in props', () => {
    const qr = QrCode.create(validProps);
    expect(qr.scanCount).toBe(0);
  });

  // Test N+3 — TPP: variable
  it('withContent() should return a new QrCode with updated content and same other props', () => {
    const qr = QrCode.create({ ...validProps, scanCount: 3 });
    const updated = qr.withContent('https://new-target.com');
    expect(updated.content).toBe('https://new-target.com');
    expect(updated.id).toBe(qr.id);
    expect(updated.userId).toBe(qr.userId);
    expect(updated.size).toBe(qr.size);
  });

  // Test N+4 — TPP: variable
  it('withContent() should preserve scanCount from original entity', () => {
    const qr = QrCode.create({ ...validProps, scanCount: 5 });
    const updated = qr.withContent('https://other.com');
    expect(updated.scanCount).toBe(5);
  });
});
