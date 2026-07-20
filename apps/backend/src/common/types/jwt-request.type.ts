/**
 * JWT 인증을 통과한 뒤의 요청 객체 타입이다.
 * AuthGuard('jwt')가 걸린 컨트롤러에서는 `req: any` 대신 이 타입을 쓴다.
 */
export interface JwtPayload {
  sub: string;
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
}

export interface JwtRequest {
  user: JwtPayload;
}
