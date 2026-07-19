import { validate } from 'class-validator';
import { EditTargetUrlDto } from './edit-target-url.dto';

const make = (content: string): EditTargetUrlDto =>
  Object.assign(new EditTargetUrlDto(), { content });

describe('EditTargetUrlDto', () => {
  // Test 18 — TPP: constant
  it('should pass validation for valid https URL', async () => {
    const errors = await validate(make('https://example.com'));
    expect(errors).toHaveLength(0);
  });

  // Test 19 — TPP: conditional
  it('should fail validation for non-URL content', async () => {
    const errors = await validate(make('not a url'));
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('content');
  });

  // Test 20 — TPP: conditional
  it('should fail validation for URL without protocol', async () => {
    const errors = await validate(make('example.com/path'));
    expect(errors).toHaveLength(1);
  });
});
