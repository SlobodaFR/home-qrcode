import { pseudonymize } from './pseudonymize';

const SECRET = 'a'.repeat(64);

describe('pseudonymize', () => {
  it('is deterministic for the same value and secret', () => {
    expect(pseudonymize('alice@example.com', SECRET)).toBe(
      pseudonymize('alice@example.com', SECRET),
    );
  });

  // Frozen on purpose: changing the normalization would re-key every log pseudonym and PostHog distinct_id.
  it('ignores case and surrounding spaces', () => {
    expect(pseudonymize(' Alice@Example.COM ', SECRET)).toBe(
      pseudonymize('alice@example.com', SECRET),
    );
  });

  it('depends on the secret', () => {
    expect(pseudonymize('alice@example.com', SECRET)).not.toBe(
      pseudonymize('alice@example.com', 'b'.repeat(64)),
    );
  });

  it('returns 16 lowercase hex characters, never the input', () => {
    const pseudonym = pseudonymize('alice@example.com', SECRET);
    expect(pseudonym).toMatch(/^[0-9a-f]{16}$/);
  });

  it('matches the frozen HMAC-SHA256 definition', () => {
    // HMAC-SHA256('alice@example.com', SECRET), first 16 hex characters.
    expect(pseudonymize('alice@example.com', SECRET)).toBe('5b32f1b41887a522');
  });
});
