import type { Socket } from 'socket.io';

/**
 * WebSocket 게이트웨이가 JwtService.verify() 로 검증한 토큰 원문 페이로드.
 *
 * HTTP 요청(JwtRequest)은 Passport 전략이 DB 사용자를 실어 주므로 식별자가 `id` 지만,
 * 소켓은 토큰을 직접 검증해 쓰기 때문에 식별자가 `sub` 다.
 * 두 형태가 실제로 다르므로 타입도 분리한다.
 */
export interface SocketJwtPayload {
  sub: string;
  email: string;
  tokenUse?: string;
  [claim: string]: unknown;
}

/**
 * WebSocket 게이트웨이에서 JWT 인증을 통과한 뒤의 Socket 타입이다.
 * `(client as any).user` 대신 이 타입을 쓴다.
 */
export interface AuthenticatedSocket extends Socket {
  user: SocketJwtPayload;
}
