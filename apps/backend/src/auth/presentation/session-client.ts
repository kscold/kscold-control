import type { Request } from 'express';
import { clientIp } from '../../common/utils/client-ip.util';
import type { SessionClient } from '../application/services/auth-session.service';

export function sessionClient(req: Request): SessionClient {
  return {
    ip: clientIp(req),
    userAgent: req.headers['user-agent']?.slice(0, 512) || null,
  };
}
