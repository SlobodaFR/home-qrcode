import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RevokedSessionOrmEntity } from '../entities/revoked-session.orm-entity';
import { UserOrmEntity } from '../entities/user.orm-entity';
import { TypeOrmRevokedSessionRepository } from './typeorm-revoked-session.repository';

describe('TypeOrmRevokedSessionRepository', () => {
  let repo: TypeOrmRevokedSessionRepository;

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
        TypeOrmModule.forFeature([RevokedSessionOrmEntity]),
      ],
      providers: [TypeOrmRevokedSessionRepository],
    }).compile();
    repo = module.get(TypeOrmRevokedSessionRepository);
  });

  // Test 17 — TPP: constant
  it('should return null for an unknown userId', async () => {
    expect(await repo.getRevokedAt('unknown')).toBeNull();
  });

  // Test 18 — TPP: variable
  it('should persist a revoked session and return revokedAt', async () => {
    const ts = new Date('2026-01-15T12:00:00Z');
    await repo.markRevoked('user-1', ts);
    const result = await repo.getRevokedAt('user-1');
    expect(result).not.toBeNull();
    expect(result!.getTime()).toBe(ts.getTime());
  });

  // Test 19 — TPP: variable
  it('should overwrite revokedAt on a second markRevoked call for the same userId', async () => {
    const first = new Date('2026-01-01T00:00:00Z');
    const second = new Date('2026-01-02T00:00:00Z');
    await repo.markRevoked('user-1', first);
    await repo.markRevoked('user-1', second);
    const result = await repo.getRevokedAt('user-1');
    expect(result!.getTime()).toBe(second.getTime());
  });
});
