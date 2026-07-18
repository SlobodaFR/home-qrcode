import { ConfigService } from '@nestjs/config';
import * as jose from 'jose';
import { JwksAccessTokenVerifier } from './jwks-access-token-verifier';

jest.mock('jose');

const mockJose = jest.mocked(jose);

describe('JwksAccessTokenVerifier', () => {
  const makeConfig = () =>
    ({ getOrThrow: jest.fn().mockReturnValue('https://auth.example.com') }) as unknown as ConfigService;

  beforeEach(() => {
    mockJose.createRemoteJWKSet.mockReturnValue(jest.fn() as unknown as ReturnType<typeof jose.createRemoteJWKSet>);
  });

  // Test 9 — TPP: constant
  it('should return null when jwtVerify throws', async () => {
    mockJose.jwtVerify.mockRejectedValue(new Error('invalid token'));
    const verifier = new JwksAccessTokenVerifier(makeConfig());
    const result = await verifier.verify('bad-token');
    expect(result).toBeNull();
  });

  // Test 10 — TPP: conditional
  it('should return null when required claims are absent from payload', async () => {
    mockJose.jwtVerify.mockResolvedValue({ payload: { sub: 'u1' }, protectedHeader: {} } as unknown as Awaited<ReturnType<typeof jose.jwtVerify>>);
    const verifier = new JwksAccessTokenVerifier(makeConfig());
    const result = await verifier.verify('token-missing-claims');
    expect(result).toBeNull();
  });
});
