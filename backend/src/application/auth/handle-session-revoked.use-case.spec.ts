import type { Mocked } from 'vitest';
import { RevokedSessionRepository } from '../../domain/auth/revoked-session.repository';
import { HandleSessionRevokedUseCase } from './handle-session-revoked.use-case';

describe('HandleSessionRevokedUseCase', () => {
  // Test 8 — TPP: constant
  it('should call markRevoked with the given userId and a Date', async () => {
    const repo: Mocked<RevokedSessionRepository> = {
      markRevoked: vi.fn().mockResolvedValue(undefined),
      getRevokedAt: vi.fn(),
    };

    const uc = new HandleSessionRevokedUseCase(repo);
    await uc.execute('user-42');

    expect(repo.markRevoked).toHaveBeenCalledWith('user-42', expect.any(Date));
  });
});
