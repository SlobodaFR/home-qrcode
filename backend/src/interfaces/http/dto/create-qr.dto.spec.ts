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

  // Test 22 (extended-content-types) — TPP: constant
  it('should accept valid wifi payload with WPA security and password', async () => {
    const dto = plainToInstance(CreateQrDto, { contentType: 'wifi', ssid: 'MyNet', security: 'WPA', password: 'secret' });
    expect(await validate(dto)).toHaveLength(0);
  });

  // Test 23 — TPP: conditional
  it('should reject wifi payload missing ssid', async () => {
    const dto = plainToInstance(CreateQrDto, { contentType: 'wifi', security: 'WPA', password: 'secret' });
    const errs = await validate(dto);
    expect(errs.some(e => e.property === 'ssid')).toBe(true);
  });

  // Test 24 — TPP: conditional
  it('should reject wifi WPA payload missing password', async () => {
    const dto = plainToInstance(CreateQrDto, { contentType: 'wifi', ssid: 'MyNet', security: 'WPA' });
    const errs = await validate(dto);
    expect(errs.some(e => e.property === 'password')).toBe(true);
  });

  // Test 25 (extended) — TPP: conditional
  it('should accept wifi nopass without password', async () => {
    const dto = plainToInstance(CreateQrDto, { contentType: 'wifi', ssid: 'OpenNet', security: 'nopass' });
    expect(await validate(dto)).toHaveLength(0);
  });

  // Test 26 (extended) — TPP: constant
  it('should accept valid email payload with to only', async () => {
    const dto = plainToInstance(CreateQrDto, { contentType: 'email', to: 'user@example.com' });
    expect(await validate(dto)).toHaveLength(0);
  });

  // Test 27 (extended) — TPP: conditional
  it('should reject email payload with invalid to address', async () => {
    const dto = plainToInstance(CreateQrDto, { contentType: 'email', to: 'not-an-email' });
    const errs = await validate(dto);
    expect(errs.some(e => e.property === 'to')).toBe(true);
  });

  // Test 28 (extended) — TPP: conditional
  it('should accept email payload with optional subject and body', async () => {
    const dto = plainToInstance(CreateQrDto, { contentType: 'email', to: 'a@b.com', subject: 'Hi', body: 'World' });
    expect(await validate(dto)).toHaveLength(0);
  });

  // Test 29 (extended) — TPP: constant
  it('should accept valid vcard payload with name only', async () => {
    const dto = plainToInstance(CreateQrDto, { contentType: 'vcard', name: 'Jane Doe' });
    expect(await validate(dto)).toHaveLength(0);
  });

  // Test 30 (extended) — TPP: conditional
  it('should reject vcard payload missing name', async () => {
    const dto = plainToInstance(CreateQrDto, { contentType: 'vcard' });
    const errs = await validate(dto);
    expect(errs.some(e => e.property === 'name')).toBe(true);
  });

  // Test 31 (extended) — TPP: conditional
  it('should accept vcard with valid vcardEmail when present', async () => {
    const dto = plainToInstance(CreateQrDto, { contentType: 'vcard', name: 'Jane', vcardEmail: 'jane@example.com' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('should reject vcard with invalid vcardEmail', async () => {
    const dto = plainToInstance(CreateQrDto, { contentType: 'vcard', name: 'Jane', vcardEmail: 'not-email' });
    const errs = await validate(dto);
    expect(errs.some(e => e.property === 'vcardEmail')).toBe(true);
  });

  // Test 32 (extended) — TPP: conditional
  it('should not require content for wifi contentType', async () => {
    const dto = plainToInstance(CreateQrDto, { contentType: 'wifi', ssid: 'Net', security: 'nopass' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('should not require content for email contentType', async () => {
    const dto = plainToInstance(CreateQrDto, { contentType: 'email', to: 'a@b.com' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('should not require content for vcard contentType', async () => {
    const dto = plainToInstance(CreateQrDto, { contentType: 'vcard', name: 'Bob' });
    expect(await validate(dto)).toHaveLength(0);
  });
});
