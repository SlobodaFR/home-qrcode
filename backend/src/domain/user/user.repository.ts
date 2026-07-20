import { User } from './user';

export abstract class UserRepository {
  abstract findById(id: string): Promise<User | null>;
  abstract findByEmail(email: string): Promise<User | null>;
  abstract findAll(): Promise<User[]>;
  abstract save(user: User): Promise<void>;
}
