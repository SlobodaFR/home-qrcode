import { parseExpiryDate } from './parse-expiry-date';

describe('parseExpiryDate', () => {
  // link-expiration: Test 5 — TPP: constant
  it("should convert 'YYYY-MM-DD' string to a Date at 23:59:59 UTC", () => {
    const result = parseExpiryDate('2026-08-25');
    expect(result).toEqual(new Date('2026-08-25T23:59:59.000Z'));
  });

  // link-expiration: Test 6 — TPP: variable
  it('should produce a Date whose UTC time components are 23/59/59', () => {
    const result = parseExpiryDate('2026-08-25');
    expect(result.getUTCHours()).toBe(23);
    expect(result.getUTCMinutes()).toBe(59);
    expect(result.getUTCSeconds()).toBe(59);
  });
});
