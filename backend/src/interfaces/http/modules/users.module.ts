import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ListUsersUseCase } from '../../../application/users/list-users.use-case';
import { UserRepository } from '../../../domain/user/user.repository';
import { UserOrmEntity } from '../../../infrastructure/persistence/entities/user.orm-entity';
import { TypeOrmUserRepository } from '../../../infrastructure/persistence/repositories/typeorm-user.repository';
import { UsersController } from '../controllers/users.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserOrmEntity])],
  controllers: [UsersController],
  providers: [
    { provide: UserRepository, useClass: TypeOrmUserRepository },
    ListUsersUseCase,
  ],
})
export class UsersModule {}
