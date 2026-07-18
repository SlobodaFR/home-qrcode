import { User } from './user';

describe('User', () => {
  const validProps = {
    id: 'sub-123',
    email: 'Test@Example.com',
    name: 'Alice',
    avatarUrl: 'https://example.com/avatar.png',
    createdAt: new Date('2026-01-01'),
  };

  // Test 1 — TPP: constant
  it('should create a user with valid props', () => {
    const user = User.create(validProps);
    expect(user.id).toBe('sub-123');
    expect(user.name).toBe('Alice');
    expect(user.avatarUrl).toBe('https://example.com/avatar.png');
    expect(user.createdAt).toEqual(new Date('2026-01-01'));
  });

  // Test 2 — TPP: variable
  it('should normalise email to lowercase on create', () => {
    const user = User.create(validProps);
    expect(user.email).toBe('test@example.com');
  });

  // Test 3 — TPP: conditional
  it('should throw when email format is invalid', () => {
    expect(() => User.create({ ...validProps, email: 'not-an-email' })).toThrow();
    expect(() => User.create({ ...validProps, email: '' })).toThrow();
  });

  // Test 4 — TPP: variable
  it('should return a new user with updated email/name/avatarUrl via withProfile()', () => {
    const user = User.create(validProps);
    const updated = user.withProfile({ email: 'New@Example.com', name: 'Bob', avatarUrl: 'https://example.com/new.png' });
    expect(updated.id).toBe(user.id);
    expect(updated.createdAt).toEqual(user.createdAt);
    expect(updated.email).toBe('new@example.com');
    expect(updated.name).toBe('Bob');
    expect(updated.avatarUrl).toBe('https://example.com/new.png');
  });
});
