import { Injectable, Inject } from '@nestjs/common';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../../rbac/domain/repositories/user.repository.interface';

/**
 * JwtStrategy가 사용하는 토큰 검증 전용 서비스.
 * 컨트롤러 로직(회원가입/로그인/내 정보)은 application/use-cases로 이동했다.
 */
@Injectable()
export class AuthService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  /**
   * JWT 검증
   */
  async validateUser(userId: string) {
    return this.userRepository.findByIdWithRoles(userId);
  }
}
