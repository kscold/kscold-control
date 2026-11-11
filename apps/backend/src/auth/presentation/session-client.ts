import type { Request } from 'express';
import { clientAddress } from '../../common/utils/client-ip.util';
import type { LoginClient } from '../../security/application/services/login-guard.service';
import type { SessionClient } from '../application/services/auth-session.service';

export function sessionClient(req: Request): SessionClient & LoginClient {
  const { ip, verified } = clientAddress(req);
  return {
    ip,
    ipVerified: verified,
    userAgent: req.headers['user-agent']?.slice(0, 512) || null,
  };
}
