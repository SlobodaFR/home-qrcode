import { QrcodeImageGenerator } from './qrcode-image-generator';

const defaultOpts = { size: 256, fgColor: '#000000', bgColor: '#FFFFFF', errorCorrection: 'M' as const };

describe('QrcodeImageGenerator', () => {
  const generator = new QrcodeImageGenerator();

  // Test 10 — TPP: constant
  it('should return a non-empty PNG Buffer and a non-empty SVG string for text content', async () => {
    const { png, svg } = await generator.generate('Hello world', defaultOpts);
    expect(Buffer.isBuffer(png)).toBe(true);
    expect(png.length).toBeGreaterThan(0);
    expect(typeof svg).toBe('string');
    expect(svg.length).toBeGreaterThan(0);
  });

  // Test 11 — TPP: variable
  it('should produce SVG output that starts with an XML/SVG tag', async () => {
    const { svg } = await generator.generate('https://example.com', defaultOpts);
    expect(svg.trimStart()).toMatch(/^(<\?xml|<svg)/);
  });
});
