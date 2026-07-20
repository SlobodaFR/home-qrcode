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

  // Test 19 — TPP: constant
  it('should accept contentType wifi and return it via getter', () => {
    const qr = QrCode.create({ ...validProps, contentType: 'wifi', content: 'HomeNet' });
    expect(qr.contentType).toBe('wifi');
  });

  // Test 20 — TPP: variable
  it('should accept contentType email and return it via getter', () => {
    const qr = QrCode.create({ ...validProps, contentType: 'email', content: 'user@example.com' });
    expect(qr.contentType).toBe('email');
  });

  // Test 21 — TPP: variable
  it('should accept contentType vcard and return it via getter', () => {
    const qr = QrCode.create({ ...validProps, contentType: 'vcard', content: 'Jane Doe' });
    expect(qr.contentType).toBe('vcard');
  });

  // Logo-overlay: Test 1 — TPP: variable
  it('should store encodedContent and expose it via getter', () => {
    const qr = QrCode.create({ ...validProps, encodedContent: 'WIFI:T:WPA;S:Home;P:pass;;' });
    expect(qr.encodedContent).toBe('WIFI:T:WPA;S:Home;P:pass;;');
  });

  // Logo-overlay: Test 2 — TPP: variable
  it('should store hasLogo: false and expose logoUrl as /api/qr/{id}/logo', () => {
    const qr = QrCode.create({ ...validProps, hasLogo: false, encodedContent: 'test' });
    expect(qr.hasLogo).toBe(false);
    expect(qr.logoUrl).toBe('/api/qr/abc-123/logo');
  });

  // Logo-overlay: Test 3 — TPP: variable
  it('withLogo() should return new instance with hasLogo true, updated errorCorrection, and logoMimeType', () => {
    const qr = QrCode.create({ ...validProps, encodedContent: 'test', hasLogo: false });
    const updated = qr.withLogo('Q', 'image/png');
    expect(updated.hasLogo).toBe(true);
    expect(updated.errorCorrection).toBe('Q');
    expect(updated.logoMimeType).toBe('image/png');
  });

  // Logo-overlay: Test 4 — TPP: conditional
  it('withLogo() should not mutate the original instance', () => {
    const qr = QrCode.create({ ...validProps, encodedContent: 'test', hasLogo: false });
    qr.withLogo('Q', 'image/png');
    expect(qr.hasLogo).toBe(false);
    expect(qr.logoMimeType).toBeNull();
  });

  // url-shortener: Test 1 — TPP: constant
  it('should return null for source when not provided', () => {
    const qr = QrCode.create(validProps);
    expect(qr.source).toBeNull();
  });

  // url-shortener: Test 2 — TPP: variable
  it('should return shortlink for source when source=shortlink is provided', () => {
    const qr = QrCode.create({ ...validProps, source: 'shortlink' });
    expect(qr.source).toBe('shortlink');
  });
});
