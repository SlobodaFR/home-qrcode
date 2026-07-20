import * as sharp from 'sharp';
import { SharpLogoCompositor } from './sharp-logo-compositor';

async function makePng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  }).png().toBuffer();
}

describe('SharpLogoCompositor', () => {
  let compositor: SharpLogoCompositor;

  beforeEach(() => {
    compositor = new SharpLogoCompositor();
  });

  // Test 5 — TPP: constant
  it('composite() should return a non-empty Buffer', async () => {
    const qrPng = await makePng(200, 200);
    const logo = await makePng(50, 50);
    const result = await compositor.composite(qrPng, logo);
    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBeGreaterThan(0);
  });

  // Test 6 — TPP: variable
  it('composite() output should have the same pixel dimensions as the input QR PNG', async () => {
    const qrPng = await makePng(200, 200);
    const logo = await makePng(300, 300);
    const result = await compositor.composite(qrPng, logo);
    const meta = await sharp(result).metadata();
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(200);
  });
});
