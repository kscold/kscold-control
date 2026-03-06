/**
 * Typed request object after JWT authentication.
 * Use instead of `req: any` in controllers guarded by AuthGuard('jwt').
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
