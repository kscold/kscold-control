import * as bcrypt from 'bcrypt';

/**
 * Password hashing utility
 * Centralizes bcrypt hashing logic to avoid duplication
 *
 * Used in:
 * - auth.service.ts (user registration)
 * - rbac.service.ts (user creation, password updates)
 */
export class PasswordHasher {
  private static readonly SALT_ROUNDS = 10;

  /**
   * Hash a plain text password
   * @param password Plain text password
   * @returns Hashed password
   */
  static async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  /**
   * Compare plain text password with hashed password
   * @param plain Plain text password
   * @param hashed Hashed password from database
   * @returns True if passwords match
   */
  static async compare(plain: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(plain, hashed);
  }

  /**
   * Validate password strength
   * @param password Password to validate
   * @returns True if password meets requirements
   */
  static validateStrength(password: string): boolean {
    // At least 8 characters
    if (password.length < 8) return false;

    // Contains at least one letter and one number (optional enhancement)
    // Uncomment if needed:
    // const hasLetter = /[a-zA-Z]/.test(password);
    // const hasNumber = /[0-9]/.test(password);
    // return hasLetter && hasNumber;

    return true;
  }
}
