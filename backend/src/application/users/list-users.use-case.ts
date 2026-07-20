import { Injectable } from '@nestjs/common';
import { User } from '../../domain/user/user';
import { UserRepository } from '../../domain/user/user.repository';

export interface ListUsersResult {
  users: User[];
}

@Injectable()
export class ListUsersUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(): Promise<ListUsersResult> {
    const users = await this.userRepository.findAll();
    return { users };
  }
}
