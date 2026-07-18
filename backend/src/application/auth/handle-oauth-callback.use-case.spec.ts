import { OAuthClient, TokenPair, UserProfile } from '../../domain/auth/oauth-client';
import { User } from '../../domain/user/user';
import { UserRepository } from '../../domain/user/user.repository';
import { HandleOAuthCallbackUseCase } from './handle-oauth-callback.use-case';

const mockTokens: TokenPair = { accessToken: 'at', refreshToken: 'rt', expiresIn: 3600 };
const mockProfile: UserProfile = { id: 'sub-1', email: 'alice@example.com', name: 'Alice', avatarUrl: 'https://a.com/a.png' };

const makeOAuthClient = (): jest.Mocked<OAuthClient> => (({
  authorizeUrl: jest.fn(),
  exchangeCode: jest.fn().mockResolvedValue(mockTokens),
  refresh: jest.fn(),
  fetchUserInfo: jest.fn().mockResolvedValue(mockProfile),
}));

const makeUserRepo = (existing: User | null = null): jest.Mocked<UserRepository> => (({
  findById: jest.fn().mockResolvedValue(existing),
  findByEmail: jest.fn(),
  save: jest.fn().mockResolvedValue(undefined),
}));

describe('HandleOAuthCallbackUseCase', () => {
  // Test 5 — TPP: constant
  it('should create and save a new user when userId is not in the repository', async () => {
    const repo = makeUserRepo(null);
    const client = makeOAuthClient();
    const uc = new HandleOAuthCallbackUseCase(client, repo);

    await uc.execute('code-abc', 'https://app/callback');

    expect(repo.save).toHaveBeenCalledTimes(1);
    const saved = repo.save.mock.calls[0][0];
    expect(saved.id).toBe('sub-1');
    expect(saved.email).toBe('alice@example.com');
  });

  // Test 6 — TPP: conditional
  it('should upsert an existing user via withProfile() when userId already exists', async () => {
    const existing = User.create({ id: 'sub-1', email: 'old@example.com', name: 'Old', avatarUrl: '', createdAt: new Date() });
    const repo = makeUserRepo(existing);
    const client = makeOAuthClient();
    const uc = new HandleOAuthCallbackUseCase(client, repo);

    const result = await uc.execute('code-abc', 'https://app/callback');

    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(result.user.email).toBe('alice@example.com');
    expect(result.user.name).toBe('Alice');
  });

  // Test 7 — TPP: variable
  it('should return the TokenPair from the OAuthClient', async () => {
    const uc = new HandleOAuthCallbackUseCase(makeOAuthClient(), makeUserRepo());
    const result = await uc.execute('code-abc', 'https://app/callback');
    expect(result.tokens).toEqual(mockTokens);
  });
});
