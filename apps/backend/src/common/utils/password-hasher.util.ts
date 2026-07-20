import * as bcrypt from 'bcrypt';

/**
 * 비밀번호 해싱 유틸리티
 * bcrypt 해싱 로직을 한곳에 모아 중복 구현을 막는다.
 *
 * 사용처:
 * - auth.service.ts (회원 가입)
 * - rbac.service.ts (사용자 생성, 비밀번호 변경)
 */
export class PasswordHasher {
  private static readonly SALT_ROUNDS = 10;

  /**
   * 평문 비밀번호를 해싱한다.
   * @param password 평문 비밀번호
   * @returns 해싱된 비밀번호
   */
  static async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  /**
   * 평문 비밀번호와 해싱된 비밀번호가 일치하는지 비교한다.
   * @param plain 평문 비밀번호
   * @param hashed DB에 저장된 해싱 비밀번호
   * @returns 일치하면 true
   */
  static async compare(plain: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(plain, hashed);
  }

  /**
   * 비밀번호 강도를 검증한다.
   * @param password 검증할 비밀번호
   * @returns 요구 조건을 충족하면 true
   */
  static validateStrength(password: string): boolean {
    // 최소 8자 이상
    if (password.length < 8) return false;

    // 영문자와 숫자를 최소 1개씩 포함하도록 강화하려면(선택)
    // 아래 주석을 해제한다.
    // const hasLetter = /[a-zA-Z]/.test(password);
    // const hasNumber = /[0-9]/.test(password);
    // return hasLetter && hasNumber;

    return true;
  }
}
