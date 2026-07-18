export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
}

export abstract class OAuthClient {
  abstract authorizeUrl(redirectUri: string): string;
  abstract exchangeCode(code: string, redirectUri: string): Promise<TokenPair>;
  abstract refresh(refreshToken: string): Promise<TokenPair>;
  abstract fetchUserInfo(accessToken: string): Promise<UserProfile>;
}
