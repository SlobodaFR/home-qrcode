import { Test } from '@nestjs/testing';
import { User } from '../../../domain/user/user';
import { ListUsersUseCase } from '../../../application/users/list-users.use-case';
import { UsersController } from './users.controller';

const makeUser = (id: string) => User.create({ id, email: `${id}@x.com`, name: `User ${id}`, avatarUrl: 'https://av.png', createdAt: new Date() });

describe('UsersController', () => {
  let controller: UsersController;
  let listUsers: jest.Mocked<ListUsersUseCase>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: ListUsersUseCase, useValue: { execute: jest.fn().mockResolvedValue({ users: [makeUser('u-1'), makeUser('u-2')] }) } },
      ],
    }).compile();
    controller = module.get(UsersController);
    listUsers = module.get(ListUsersUseCase);
  });

  // T29 — TPP: constant
  it('should call ListUsersUseCase and return array of {id, name, email, avatarUrl}', async () => {
    const result = await controller.list();
    expect(listUsers.execute).toHaveBeenCalled();
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: 'u-1', name: 'User u-1', email: 'u-1@x.com', avatarUrl: 'https://av.png' });
  });
});
