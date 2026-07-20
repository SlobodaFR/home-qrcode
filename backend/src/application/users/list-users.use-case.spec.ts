import { User } from '../../domain/user/user';
import { UserRepository } from '../../domain/user/user.repository';
import { ListUsersUseCase } from './list-users.use-case';

const makeUser = (id: string) => User.create({ id, email: `${id}@x.com`, name: id, avatarUrl: '', createdAt: new Date() });

const makeRepo = (users: User[]): jest.Mocked<UserRepository> => ({
  findById: jest.fn(),
  findByEmail: jest.fn(),
  findAll: jest.fn().mockResolvedValue(users),
  save: jest.fn(),
});

describe('ListUsersUseCase', () => {
  // T13 — TPP: constant
  it('should return all users from userRepository.findAll()', async () => {
    const users = [makeUser('u-1'), makeUser('u-2')];
    const result = await new ListUsersUseCase(makeRepo(users)).execute();
    expect(result.users).toHaveLength(2);
    expect(result.users[0].id).toBe('u-1');
  });
});
