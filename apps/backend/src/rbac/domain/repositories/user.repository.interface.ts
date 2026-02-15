import { User } from '../entities/user.entity';

/**
 * User Repository Interface
 * Domain layer abstraction for user data access
 */
export interface IUserRepository {
  /**
   * Find user by ID
   */
  findById(id: string): Promise<User | null>;

  /**
   * Find user by email
   */
  findByEmail(email: string): Promise<User | null>;

  /**
   * Find user by ID with roles and permissions
   */
  findByIdWithRoles(id: string): Promise<User | null>;

  /**
   * Find user by email with roles and permissions
   */
  findByEmailWithRoles(email: string): Promise<User | null>;

  /**
   * Find all users
   */
  findAll(): Promise<User[]>;

  /**
   * Find all users with their roles and permissions
   */
  findAllWithRoles(): Promise<User[]>;

  /**
   * Create a new user
   */
  create(userData: Partial<User>): User;

  /**
   * Save user (create or update)
   */
  save(user: User): Promise<User>;

  /**
   * Delete user by ID
   */
  delete(id: string): Promise<void>;

  /**
   * Update user's terminal command count
   */
  incrementTerminalCommandCount(userId: string): Promise<void>;

  /**
   * Reset terminal command count
   */
  resetTerminalCommandCount(userId: string): Promise<void>;

  /**
   * Update terminal command limit
   */
  updateTerminalCommandLimit(
    userId: string,
    limit: number,
  ): Promise<User | null>;
}

/**
 * Dependency Injection token for User Repository
 */
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
