import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateQrDto } from './create-qr.dto';

const valid = (overrides = {}) =>
  plainToInstance(CreateQrDto, { contentType: 'url', content: 'https://example.com', ...overrides });

describe('CreateQrDto', () => {
  // Test 25 — TPP: constant
  it('should pass validation for a valid url DTO with all fields', async () => {
    const dto = valid({ size: 1024, fgColor: '#000000', bgColor: '#FFFFFF', errorCorrection: 'M' });
    expect(await validate(dto)).toHaveLength(0);
  });

  // Test 26 — TPP: constant
  it('should pass validation for a valid text DTO with only required fields', async () => {
    const dto = plainToInstance(CreateQrDto, { contentType: 'text', content: 'Hello' });
    expect(await validate(dto)).toHaveLength(0);
  });

  // Test 27 — TPP: conditional
  it('should fail validation when content is empty', async () => {
    const dto = valid({ content: '' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.property === 'content')).toBe(true);
  });

  // Test 28 — TPP: conditional
  it('should fail validation when contentType is "url" and content is not http/https', async () => {
    const dto = valid({ contentType: 'url', content: 'ftp://example.com' });
    const errors = await validate(dto);
    expect(errors.some(e => e.property === 'content')).toBe(true);
  });

  // Test 29 — TPP: conditional
  it('should fail validation when fgColor does not match #RRGGBB pattern', async () => {
    const dto = valid({ fgColor: 'red' });
    const errors = await validate(dto);
    expect(errors.some(e => e.property === 'fgColor')).toBe(true);
  });

  // Test 30 — TPP: conditional
  it('should fail validation when size is below 128', async () => {
    const dto = valid({ size: 64 });
    const errors = await validate(dto);
    expect(errors.some(e => e.property === 'size')).toBe(true);
  });

  // Test 31 — TPP: conditional
  it('should fail validation when size is above 4096', async () => {
    const dto = valid({ size: 8192 });
    const errors = await validate(dto);
    expect(errors.some(e => e.property === 'size')).toBe(true);
  });

  // Test 32 — TPP: variable
  it('should apply defaults: size 1024, fgColor #000000, bgColor #FFFFFF, errorCorrection M', async () => {
    const dto = plainToInstance(CreateQrDto, { contentType: 'text', content: 'Hello' });
    expect(dto.size).toBe(1024);
    expect(dto.fgColor).toBe('#000000');
    expect(dto.bgColor).toBe('#FFFFFF');
    expect(dto.errorCorrection).toBe('M');
  });
});
