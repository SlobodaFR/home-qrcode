import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SetExpirationDto } from './set-expiration.dto';

describe('SetExpirationDto', () => {
  // link-expiration: Test 22 — TPP: constant
  it("should pass validation with a valid date-only string '2026-08-25'", async () => {
    const dto = plainToInstance(SetExpirationDto, { expiresAt: '2026-08-25' });
    expect(await validate(dto)).toHaveLength(0);
  });

  // link-expiration: Test 23 — TPP: conditional
  it("should fail validation with non-date string 'hello'", async () => {
    const dto = plainToInstance(SetExpirationDto, { expiresAt: 'hello' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.property === 'expiresAt')).toBe(true);
  });

  // link-expiration: Test 24 — TPP: conditional
  it('should pass validation with null (clears expiry)', async () => {
    const dto = plainToInstance(SetExpirationDto, { expiresAt: null });
    expect(await validate(dto)).toHaveLength(0);
  });

  // link-expiration: Test 25 — TPP: conditional
  it('should fail validation when expiresAt is absent from body (undefined)', async () => {
    const dto = plainToInstance(SetExpirationDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.property === 'expiresAt')).toBe(true);
  });
});
