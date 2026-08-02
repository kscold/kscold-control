/**
 * JWT 인증을 통과한 뒤의 요청 객체 타입이다.
 * AuthGuard('jwt')가 걸린 컨트롤러에서는 `req: any` 대신 이 타입을 쓴다.
 */
/**
 * HTTP 요청에 실리는 인증 사용자 정보.
 *
 * JwtStrategy 가 DB 사용자 엔티티를 펼쳐 넣으므로 식별자는 `id` 다.
 * 토큰 원문의 `sub` 는 여기에 없다. WebSocket 게이트웨이는 원문 페이로드를
 * 그대로 쓰기 때문에 `sub` 를 쓰는데, 두 형태를 한 타입으로 덮으면
 * 존재하지 않는 필드를 읽어도 타입 검사를 통과한다.
 * (실제로 그 때문에 프로젝트 소유자가 저장되지 않는 문제가 있었다)
 */
export interface JwtPayload {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
  /**
   * WebSocket 경로에서만 존재하는 토큰 subject.
   * HTTP 요청에는 없으므로 선택 필드로 둔다.
   */
  sub?: string;
}

export interface JwtRequest {
  user: JwtPayload;
}
