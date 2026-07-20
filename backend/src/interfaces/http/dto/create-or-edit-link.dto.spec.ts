import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateOrEditLinkDto } from './create-or-edit-link.dto';

describe('CreateOrEditLinkDto', () => {
  // link-expiration: Test 28 — TPP: variable
  it("should accept valid optional expiresAt '2026-08-25'", async () => {
    const dto = plainToInstance(CreateOrEditLinkDto, { url: 'https://example.com', expiresAt: '2026-08-25' });
    expect(await validate(dto)).toHaveLength(0);
  });

  // link-expiration: Test 29 — TPP: conditional
  it('should still pass when expiresAt is omitted', async () => {
    const dto = plainToInstance(CreateOrEditLinkDto, { url: 'https://example.com' });
    expect(await validate(dto)).toHaveLength(0);
  });
});
