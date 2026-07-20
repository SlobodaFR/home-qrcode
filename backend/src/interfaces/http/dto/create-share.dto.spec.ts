import { validate } from 'class-validator';
import { CreateShareDto } from './create-share.dto';

describe('CreateShareDto', () => {
  // T25 — TPP: constant
  it('should pass validation with valid non-empty recipientId', async () => {
    const dto = Object.assign(new CreateShareDto(), { recipientId: 'user-123' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  // T26 — TPP: conditional
  it('should fail validation with empty string recipientId', async () => {
    const dto = Object.assign(new CreateShareDto(), { recipientId: '' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
