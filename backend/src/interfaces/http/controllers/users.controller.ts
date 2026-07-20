import { Controller, Get } from '@nestjs/common';
import { ListUsersUseCase } from '../../../application/users/list-users.use-case';

@Controller('users')
export class UsersController {
  constructor(private readonly listUsers: ListUsersUseCase) {}

  @Get()
  async list() {
    const { users } = await this.listUsers.execute();
    return users.map((u) => ({ id: u.id, name: u.name, email: u.email, avatarUrl: u.avatarUrl }));
  }
}
