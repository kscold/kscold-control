import type { Socket } from 'socket.io';
import type { JwtPayload } from './jwt-request.type';

/**
 * Typed Socket after JWT authentication in WebSocket gateways.
 * Use instead of `(client as any).user` in gateways guarded by JwtService.verify().
 */
export interface AuthenticatedSocket extends Socket {
  user: JwtPayload;
}
