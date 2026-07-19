import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ListQrDto } from './list-qr.dto';

const make = (obj: Record<string, unknown>) => plainToInstance(ListQrDto, obj);

describe('ListQrDto', () => {
  // Test 21 — TPP: constant
  it('should pass validation with default values (no params)', async () => {
    const dto = make({});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
  });

  // Test 22 — TPP: conditional
  it('should fail validation for page < 1', async () => {
    const errors = await validate(make({ page: 0 }));
    expect(errors.some(e => e.property === 'page')).toBe(true);
  });

  // Test 23 — TPP: conditional
  it('should fail validation for limit = 0', async () => {
    const errors = await validate(make({ limit: 0 }));
    expect(errors.some(e => e.property === 'limit')).toBe(true);
  });

  // Test 24 — TPP: conditional
  it('should fail validation for limit > 100', async () => {
    const errors = await validate(make({ limit: 101 }));
    expect(errors.some(e => e.property === 'limit')).toBe(true);
  });
});
