import type { Socket } from 'socket.io';
import type { JwtPayload } from './jwt-request.type';

/**
 * WebSocket 게이트웨이에서 JWT 인증을 통과한 뒤의 Socket 타입이다.
 * JwtService.verify()로 인증하는 게이트웨이에서는 `(client as any).user` 대신 이 타입을 쓴다.
 */
export interface AuthenticatedSocket extends Socket {
  user: JwtPayload;
}
