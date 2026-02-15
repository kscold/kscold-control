import { Injectable, Inject } from '@nestjs/common';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../domain/repositories/user.repository.interface';
import { UserResponseDto } from '../dto/user-response.dto';

/**
 * List Users Use Case
 * Business logic for retrieving all users with roles
 */
@Injectable()
export class ListUsersUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(): Promise<UserResponseDto[]> {
    const users = await this.userRepository.findAllWithRoles();
    return UserResponseDto.fromEntities(users, true);
  }
}
