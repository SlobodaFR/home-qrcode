export abstract class RevokedSessionRepository {
  abstract markRevoked(userId: string, revokedAt: Date): Promise<void>;
  abstract getRevokedAt(userId: string): Promise<Date | null>;
}
