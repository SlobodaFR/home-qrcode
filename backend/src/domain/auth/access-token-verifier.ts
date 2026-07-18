import { AccessTokenPayload } from './access-token-payload';

export abstract class AccessTokenVerifier {
  abstract verify(token: string): Promise<AccessTokenPayload | null>;
}
