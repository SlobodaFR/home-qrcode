import { Injectable } from '@nestjs/common';
import { RevokedSessionRepository } from '../../domain/auth/revoked-session.repository';

@Injectable()
export class HandleSessionRevokedUseCase {
  constructor(
    private readonly revokedSessionRepository: RevokedSessionRepository,
  ) {}

  async execute(userId: string): Promise<void> {
    await this.revokedSessionRepository.markRevoked(userId, new Date());
  }
}
