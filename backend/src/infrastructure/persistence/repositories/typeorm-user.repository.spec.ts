import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../../domain/user/user';
import { RevokedSessionOrmEntity } from '../entities/revoked-session.orm-entity';
import { UserOrmEntity } from '../entities/user.orm-entity';
import { TypeOrmUserRepository } from './typeorm-user.repository';

const makeUser = (overrides: Partial<{ id: string; email: string; name: string }> = {}) =>
  User.create({
    id: overrides.id ?? 'sub-1',
    email: overrides.email ?? 'alice@example.com',
    name: overrides.name ?? 'Alice',
    avatarUrl: 'https://a.com/a.png',
    createdAt: new Date('2026-01-01'),
  });

describe('TypeOrmUserRepository', () => {
  let repo: TypeOrmUserRepository;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [UserOrmEntity, RevokedSessionOrmEntity],
          synchronize: true,
          enableWAL: false,
        }),
        TypeOrmModule.forFeature([UserOrmEntity]),
      ],
      providers: [TypeOrmUserRepository],
    }).compile();
    repo = module.get(TypeOrmUserRepository);
  });

  // Test 13 — TPP: constant
  it('should return null for an unknown user id', async () => {
    expect(await repo.findById('unknown')).toBeNull();
  });

  // Test 14 — TPP: variable
  it('should save a new user and retrieve it by id', async () => {
    const user = makeUser();
    await repo.save(user);
    const found = await repo.findById('sub-1');
    expect(found).not.toBeNull();
    expect(found!.email).toBe('alice@example.com');
    expect(found!.name).toBe('Alice');
  });

  // Test 15 — TPP: variable
  it('should find a user by email case-insensitively', async () => {
    await repo.save(makeUser({ email: 'alice@example.com' }));
    const found = await repo.findByEmail('ALICE@EXAMPLE.COM');
    expect(found).not.toBeNull();
    expect(found!.id).toBe('sub-1');
  });

  // Test 16 — TPP: variable
  it('should overwrite name/email/avatarUrl when saving a user with an existing id', async () => {
    await repo.save(makeUser({ name: 'Alice' }));
    const updated = makeUser({ name: 'Alice Updated' });
    await repo.save(updated);
    const found = await repo.findById('sub-1');
    expect(found!.name).toBe('Alice Updated');
  });
});
